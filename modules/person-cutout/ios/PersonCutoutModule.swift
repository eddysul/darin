import ExpoModulesCore
import UIKit
import Vision
import CoreImage
import ImageIO
import UniformTypeIdentifiers

public class PersonCutoutModule: Module {
  private let context = CIContext(options: nil)

  public func definition() -> ModuleDefinition {
    Name("PersonCutout")

    Function("isAvailable") { () -> Bool in
      if #available(iOS 15.0, *) {
        return true
      }
      return false
    }

    AsyncFunction("createPersonCutout") { (imageUri: String, featherRadius: Double) -> String in
      guard #available(iOS 15.0, *) else {
        throw PersonCutoutError.unsupported
      }
      let image = try Self.loadUIImage(from: imageUri)
      guard let cgImage = image.cgImage else {
        throw PersonCutoutError.invalidImage
      }

      let request = VNGeneratePersonSegmentationRequest()
      request.qualityLevel = .accurate
      request.outputPixelFormat = kCVPixelFormatType_OneComponent8

      let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
      try handler.perform([request])

      guard let result = request.results?.first as? VNPixelBufferObservation else {
        throw PersonCutoutError.noPerson
      }

      let maskCI = CIImage(cvPixelBuffer: result.pixelBuffer)
      let sourceCI = CIImage(cgImage: cgImage)

      // Scale mask to match source image size
      let scaleX = sourceCI.extent.width / maskCI.extent.width
      let scaleY = sourceCI.extent.height / maskCI.extent.height
      var scaledMask = maskCI.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

      let blurRadius = max(0.5, min(featherRadius, 12.0))
      if let blurred = scaledMask.applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: blurRadius
      ]).cropped(to: sourceCI.extent) as CIImage? {
        scaledMask = blurred
      }

      // Soften / normalize alpha for cleaner edges
      scaledMask = scaledMask.applyingFilter("CIColorControls", parameters: [
        kCIInputContrastKey: 1.15,
        kCIInputBrightnessKey: 0.0,
        kCIInputSaturationKey: 1.0
      ])

      let clearBackground = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0))
        .cropped(to: sourceCI.extent)

      guard let cutout = CIFilter(name: "CIBlendWithMask", parameters: [
        kCIInputImageKey: sourceCI,
        kCIInputBackgroundImageKey: clearBackground,
        kCIInputMaskImageKey: scaledMask
      ])?.outputImage?.cropped(to: sourceCI.extent) else {
        throw PersonCutoutError.processingFailed
      }

      // Skip empty masks (no person detected)
      if try Self.maskCoverage(scaledMask, context: self.context) < 0.01 {
        throw PersonCutoutError.noPerson
      }

      let cropped = try Self.cropTransparentBounds(cutout, context: self.context) ?? cutout
      return try Self.writePNG(cropped, context: self.context, prefix: "person-cutout")
    }

    AsyncFunction("createCircularCutout") { (imageUri: String) -> String in
      let image = try Self.loadUIImage(from: imageUri)
      let size = min(image.size.width, image.size.height)
      let outputSize = CGSize(width: size, height: size)
      let renderer = UIGraphicsImageRenderer(size: outputSize)
      let circled = renderer.image { ctx in
        let rect = CGRect(origin: .zero, size: outputSize)
        UIBezierPath(ovalIn: rect).addClip()
        let origin = CGPoint(
          x: (size - image.size.width) / 2.0,
          y: (size - image.size.height) / 2.0
        )
        image.draw(at: origin)
      }
      guard let data = circled.pngData() else {
        throw PersonCutoutError.processingFailed
      }
      return try Self.writeData(data, prefix: "circular-cutout", ext: "png")
    }
  }

  private static func loadUIImage(from uri: String) throws -> UIImage {
    let cleaned = uri.removingPercentEncoding ?? uri
    if cleaned.hasPrefix("file://"), let url = URL(string: cleaned), let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
      return image.normalizedOrientation()
    }
    if cleaned.hasPrefix("/"), let image = UIImage(contentsOfFile: cleaned) {
      return image.normalizedOrientation()
    }
    if let url = URL(string: cleaned), let data = try? Data(contentsOf: url), let image = UIImage(data: data) {
      return image.normalizedOrientation()
    }
    throw PersonCutoutError.invalidImage
  }

  private static func maskCoverage(_ mask: CIImage, context: CIContext) throws -> CGFloat {
    let extent = mask.extent
    guard extent.width > 0, extent.height > 0 else { return 0 }
    // Downsample for a cheap average alpha estimate
    let scale = min(64.0 / extent.width, 64.0 / extent.height, 1.0)
    let small = mask.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    guard let cg = context.createCGImage(small, from: small.extent) else { return 0 }

    let width = cg.width
    let height = cg.height
    var pixels = [UInt8](repeating: 0, count: width * height)
    let colorSpace = CGColorSpaceCreateDeviceGray()
    guard let bitmap = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.none.rawValue
    ) else { return 0 }
    bitmap.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    let sum = pixels.reduce(0) { $0 + Int($1) }
    return CGFloat(sum) / CGFloat(max(1, width * height * 255))
  }

  private static func cropTransparentBounds(_ image: CIImage, context: CIContext) throws -> CIImage? {
    guard let cg = context.createCGImage(image, from: image.extent) else { return nil }
    let width = cg.width
    let height = cg.height
    guard width > 0, height > 0 else { return nil }

    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let bitmap = CGContext(
      data: &pixels,
      width: width,
      height: height,
      bitsPerComponent: 8,
      bytesPerRow: width * 4,
      space: colorSpace,
      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { return nil }
    bitmap.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))

    var minX = width
    var minY = height
    var maxX = 0
    var maxY = 0
    var found = false
    for y in 0..<height {
      for x in 0..<width {
        let alpha = pixels[(y * width + x) * 4 + 3]
        if alpha > 12 {
          found = true
          minX = min(minX, x)
          minY = min(minY, y)
          maxX = max(maxX, x)
          maxY = max(maxY, y)
        }
      }
    }
    guard found else { return nil }

    let pad = 4
    let left = max(0, minX - pad)
    let top = max(0, minY - pad)
    let right = min(width - 1, maxX + pad)
    let bottom = min(height - 1, maxY + pad)
    // CIImage y is bottom-up relative to CGImage
    let cropRect = CGRect(
      x: CGFloat(left) + image.extent.origin.x,
      y: image.extent.origin.y + CGFloat(height - 1 - bottom),
      width: CGFloat(right - left + 1),
      height: CGFloat(bottom - top + 1)
    )
    return image.cropped(to: cropRect).transformed(
      by: CGAffineTransform(translationX: -cropRect.origin.x, y: -cropRect.origin.y)
    )
  }

  private static func writePNG(_ image: CIImage, context: CIContext, prefix: String) throws -> String {
    guard let cg = context.createCGImage(image, from: image.extent) else {
      throw PersonCutoutError.processingFailed
    }
    let ui = UIImage(cgImage: cg)
    guard let data = ui.pngData() else {
      throw PersonCutoutError.processingFailed
    }
    return try writeData(data, prefix: prefix, ext: "png")
  }

  private static func writeData(_ data: Data, prefix: String, ext: String) throws -> String {
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("darin-stickers", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let url = dir.appendingPathComponent("\(prefix)-\(UUID().uuidString).\(ext)")
    try data.write(to: url, options: .atomic)
    return url.absoluteString
  }
}

enum PersonCutoutError: Error, LocalizedError {
  case unsupported
  case invalidImage
  case noPerson
  case processingFailed

  var errorDescription: String? {
    switch self {
    case .unsupported: return "Person cutout requires iOS 15+"
    case .invalidImage: return "Could not load image"
    case .noPerson: return "No person detected in image"
    case .processingFailed: return "Cutout processing failed"
    }
  }
}

private extension UIImage {
  func normalizedOrientation() -> UIImage {
    if imageOrientation == .up { return self }
    UIGraphicsBeginImageContextWithOptions(size, false, scale)
    draw(in: CGRect(origin: .zero, size: size))
    let normalized = UIGraphicsGetImageFromCurrentImageContext()
    UIGraphicsEndImageContext()
    return normalized ?? self
  }
}
