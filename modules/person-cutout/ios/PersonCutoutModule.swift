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
      try Self.rethrowAsBridgedError {
        guard #available(iOS 15.0, *) else {
          throw PersonCutoutError.unsupported
        }
        return try Self.makePersonCutout(
          from: imageUri,
          featherRadius: featherRadius,
          context: self.context
        )
      }
    }

    AsyncFunction("createCircularCutout") { (imageUri: String) -> String in
      try Self.rethrowAsBridgedError {
        try Self.makeCircularCutout(from: imageUri, offsetX: 0.5, offsetY: 0.5, zoom: 1)
      }
    }

    AsyncFunction("createCircularCutoutFramed") { (imageUri: String, offsetX: Double, offsetY: Double, zoom: Double) -> String in
      try Self.rethrowAsBridgedError {
        try Self.makeCircularCutout(from: imageUri, offsetX: offsetX, offsetY: offsetY, zoom: zoom)
      }
    }

    AsyncFunction("createRoundedRectCutoutFramed") { (imageUri: String, offsetX: Double, offsetY: Double, zoom: Double) -> String in
      try Self.rethrowAsBridgedError {
        try Self.makeFramedCutout(from: imageUri, offsetX: offsetX, offsetY: offsetY, zoom: zoom, rounded: true)
      }
    }
  }

  /// Swift enums become `Foundation._GenericObjCError` in JS unless they are real NSErrors.
  @discardableResult
  private static func rethrowAsBridgedError<T>(_ work: () throws -> T) throws -> T {
    do {
      return try work()
    } catch let error as PersonCutoutError {
      throw error.bridged
    } catch {
      throw PersonCutoutError.processingFailed.bridged
    }
  }

  /// Person segmentation first; baby close-ups often return an empty mask, so fall back to a soft face oval.
  @available(iOS 15.0, *)
  private static func makePersonCutout(
    from imageUri: String,
    featherRadius: Double,
    context: CIContext
  ) throws -> String {
    let image = try loadUIImage(from: imageUri)
    guard let cgImage = ensureCGImage(image) else {
      throw PersonCutoutError.invalidImage
    }

    let sourceCI = CIImage(cgImage: cgImage)
    let blurRadius = max(0.5, min(featherRadius, 12.0))
    var mask = personSegmentationMask(cgImage: cgImage, sourceExtent: sourceCI.extent, feather: blurRadius)

    let personCoverage = (try? mask.map { try maskCoverage($0, context: context) }) ?? 0
    if personCoverage < 0.008, let faceMask = faceSoftMask(cgImage: cgImage, sourceExtent: sourceCI.extent, feather: blurRadius) {
      if let existing = mask {
        mask = existing.applyingFilter("CIMaximumCompositing", parameters: [
          kCIInputBackgroundImageKey: faceMask
        ])
      } else {
        mask = faceMask
      }
    }

    guard let scaledMask = mask, (try maskCoverage(scaledMask, context: context)) >= 0.004 else {
      throw PersonCutoutError.noPerson
    }

    let clearBackground = CIImage(color: CIColor(red: 0, green: 0, blue: 0, alpha: 0))
      .cropped(to: sourceCI.extent)

    guard let cutout = CIFilter(name: "CIBlendWithMask", parameters: [
      kCIInputImageKey: sourceCI,
      kCIInputBackgroundImageKey: clearBackground,
      kCIInputMaskImageKey: scaledMask
    ])?.outputImage?.cropped(to: sourceCI.extent) else {
      throw PersonCutoutError.processingFailed
    }

    let cropped = try cropTransparentBounds(cutout, context: context) ?? cutout
    return try writePNG(cropped, context: context, prefix: "person-cutout")
  }

  @available(iOS 15.0, *)
  private static func personSegmentationMask(
    cgImage: CGImage,
    sourceExtent: CGRect,
    feather: Double
  ) -> CIImage? {
    let qualities: [VNGeneratePersonSegmentationRequest.QualityLevel] = [.accurate, .balanced]
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    for quality in qualities {
      let request = VNGeneratePersonSegmentationRequest()
      request.qualityLevel = quality
      request.outputPixelFormat = kCVPixelFormatType_OneComponent8
      do {
        try handler.perform([request])
      } catch {
        continue
      }
      guard let result = request.results?.first as? VNPixelBufferObservation else { continue }
      let maskCI = CIImage(cvPixelBuffer: result.pixelBuffer)
      guard maskCI.extent.width > 0, maskCI.extent.height > 0 else { continue }
      let scaleX = sourceExtent.width / maskCI.extent.width
      let scaleY = sourceExtent.height / maskCI.extent.height
      var scaledMask = maskCI.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
      if let blurred = scaledMask.applyingFilter("CIGaussianBlur", parameters: [
        kCIInputRadiusKey: feather
      ]).cropped(to: sourceExtent) as CIImage? {
        scaledMask = blurred
      }
      scaledMask = scaledMask.applyingFilter("CIColorControls", parameters: [
        kCIInputContrastKey: 1.15,
        kCIInputBrightnessKey: 0.0,
        kCIInputSaturationKey: 1.0
      ])
      return scaledMask
    }
    return nil
  }

  @available(iOS 15.0, *)
  private static func faceSoftMask(
    cgImage: CGImage,
    sourceExtent: CGRect,
    feather: Double
  ) -> CIImage? {
    let request = VNDetectFaceRectanglesRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
      try handler.perform([request])
    } catch {
      return nil
    }
    guard let faces = request.results, !faces.isEmpty else { return nil }

    let width = sourceExtent.width
    let height = sourceExtent.height
    let maskUI = onMain {
      let format = UIGraphicsImageRendererFormat.default()
      format.opaque = true
      format.scale = 1
      let renderer = UIGraphicsImageRenderer(size: CGSize(width: width, height: height), format: format)
      return renderer.image { _ in
        UIColor.black.setFill()
        UIRectFill(CGRect(origin: .zero, size: CGSize(width: width, height: height)))
        UIColor.white.setFill()
        for face in faces {
          let box = face.boundingBox
          let faceW = box.width * width
          let faceH = box.height * height
          let faceRect = CGRect(
            x: box.origin.x * width,
            y: (1 - box.origin.y - box.height) * height,
            width: faceW,
            height: faceH
          )
          let ovalW = faceW * 2.2
          let ovalH = faceH * 2.7
          let oval = CGRect(
            x: faceRect.midX - ovalW / 2,
            y: faceRect.midY - ovalH * 0.46,
            width: ovalW,
            height: ovalH
          )
          UIBezierPath(ovalIn: oval).fill()
        }
      }
    }
    guard let maskCG = maskUI.cgImage else { return nil }
    var maskCI = CIImage(cgImage: maskCG)
    let blur = max(2.0, min(feather * 3.2, 18.0))
    maskCI = maskCI.applyingFilter("CIGaussianBlur", parameters: [
      kCIInputRadiusKey: blur
    ]).cropped(to: sourceExtent)
    return maskCI
  }

  /// Circular transparent PNG. offsetX/Y are the crop center in 0...1 image space; zoom >= 1 tightens the crop.
  private static func makeCircularCutout(
    from imageUri: String,
    offsetX: Double,
    offsetY: Double,
    zoom: Double
  ) throws -> String {
    return try makeFramedCutout(
      from: imageUri,
      offsetX: offsetX,
      offsetY: offsetY,
      zoom: zoom,
      rounded: false
    )
  }

  private static func makeFramedCutout(
    from imageUri: String,
    offsetX: Double,
    offsetY: Double,
    zoom: Double,
    rounded: Bool
  ) throws -> String {
    let image = try loadUIImage(from: imageUri)
    let width = image.size.width
    let height = image.size.height
    guard width > 0, height > 0 else {
      throw PersonCutoutError.invalidImage
    }

    let zoomClamped = min(max(zoom, 1.0), 8.0)
    let cropSide = min(width, height) / CGFloat(zoomClamped)
    var originX = CGFloat(min(max(offsetX, 0.0), 1.0)) * width - cropSide / 2
    var originY = CGFloat(min(max(offsetY, 0.0), 1.0)) * height - cropSide / 2
    originX = min(max(0 as CGFloat, originX), width - cropSide)
    originY = min(max(0 as CGFloat, originY), height - cropSide)

    let outputSide = min(max(cropSide, 256 as CGFloat), 1024 as CGFloat)
    let outputSize = CGSize(width: outputSide, height: outputSide)
    let cropped = onMain {
      let format = UIGraphicsImageRendererFormat.default()
      format.opaque = false
      let renderer = UIGraphicsImageRenderer(size: outputSize, format: format)
      return renderer.image { _ in
        let rect = CGRect(origin: .zero, size: outputSize)
        if rounded {
          UIBezierPath(roundedRect: rect, cornerRadius: outputSide * 0.14).addClip()
        } else {
          UIBezierPath(ovalIn: rect).addClip()
        }
        let drawScale = outputSide / cropSide
        image.draw(in: CGRect(
          x: -originX * drawScale,
          y: -originY * drawScale,
          width: width * drawScale,
          height: height * drawScale
        ))
      }
    }
    guard let data = cropped.pngData() else {
      throw PersonCutoutError.processingFailed
    }
    return try writeData(data, prefix: rounded ? "rounded-rect-cutout" : "circular-cutout", ext: "png")
  }

  private static func loadUIImage(from uri: String) throws -> UIImage {
    let trimmed = uri.trimmingCharacters(in: .whitespacesAndNewlines)
    if let fileURL = fileURL(from: trimmed) {
      if let image = UIImage(contentsOfFile: fileURL.path) {
        return rasterizeIfNeeded(image.normalizedOrientation())
      }
      if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
        return rasterizeIfNeeded(image.normalizedOrientation())
      }
    }
    if trimmed.hasPrefix("/"), let image = UIImage(contentsOfFile: trimmed) {
      return rasterizeIfNeeded(image.normalizedOrientation())
    }
    throw PersonCutoutError.invalidImage
  }

  private static func fileURL(from uri: String) -> URL? {
    if uri.hasPrefix("file://") {
      if let url = URL(string: uri), url.isFileURL {
        return url
      }
      let path = String(uri.dropFirst("file://".count))
      return URL(fileURLWithPath: path.removingPercentEncoding ?? path)
    }
    if uri.hasPrefix("/") {
      return URL(fileURLWithPath: uri.removingPercentEncoding ?? uri)
    }
    return nil
  }

  private static func rasterizeIfNeeded(_ image: UIImage) -> UIImage {
    if image.cgImage != nil { return image }
    return onMain {
      let format = UIGraphicsImageRendererFormat.default()
      format.opaque = false
      format.scale = image.scale > 0 ? image.scale : 1
      let renderer = UIGraphicsImageRenderer(size: image.size, format: format)
      return renderer.image { _ in
        image.draw(in: CGRect(origin: .zero, size: image.size))
      }
    }
  }

  private static func onMain<T>(_ work: () -> T) -> T {
    if Thread.isMainThread { return work() }
    return DispatchQueue.main.sync(execute: work)
  }

  private static func ensureCGImage(_ image: UIImage) -> CGImage? {
    image.cgImage ?? rasterizeIfNeeded(image).cgImage
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
    do {
      let dir = FileManager.default.temporaryDirectory
        .appendingPathComponent("darin-stickers", isDirectory: true)
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      let url = dir.appendingPathComponent("\(prefix)-\(UUID().uuidString).\(ext)")
      try data.write(to: url, options: .atomic)
      return url.absoluteString
    } catch {
      throw PersonCutoutError.processingFailed
    }
  }
}

enum PersonCutoutError: Int, Error, LocalizedError, CustomNSError {
  case unsupported = 1
  case invalidImage = 2
  case noPerson = 3
  case processingFailed = 4

  static var errorDomain: String { "app.darin.PersonCutout" }

  var errorCode: Int { rawValue }

  var errorUserInfo: [String: Any] {
    [NSLocalizedDescriptionKey: errorDescription ?? ""]
  }

  var errorDescription: String? {
    switch self {
    case .unsupported: return "이 기기는 인물 컷아웃을 지원하지 않아요."
    case .invalidImage: return "사진을 불러오지 못했어요."
    case .noPerson: return "사진에서 아기 얼굴을 찾지 못했어요. 얼굴이 잘 보이게 찍어 주세요."
    case .processingFailed: return "배경을 지우는 중 문제가 생겼어요."
    }
  }

  var bridged: NSError {
    NSError(domain: Self.errorDomain, code: errorCode, userInfo: errorUserInfo)
  }
}

private extension UIImage {
  func normalizedOrientation() -> UIImage {
    if imageOrientation == .up { return self }
    let redraw = {
      UIGraphicsBeginImageContextWithOptions(self.size, false, self.scale)
      self.draw(in: CGRect(origin: .zero, size: self.size))
      let normalized = UIGraphicsGetImageFromCurrentImageContext()
      UIGraphicsEndImageContext()
      return normalized ?? self
    }
    if Thread.isMainThread { return redraw() }
    return DispatchQueue.main.sync(execute: redraw)
  }
}
