BizCrush STT API는 파일을 직접 받지 않고 오디오 파일의 URL을 요구합니다.   
그래서 우리 서버가 파일을 임시로 저장하고 BizCrush에게 "이 URL에서 파일    가져가" 라고 알려줘야 해요.                                                
                                                                             
  BASE_URL은 우리 FastAPI 서버의 공개 주소입니다.                            
                                                                             
  예시:                                                                      
  - 배포된 서버라면 → https://api.darin.com                 
  - 로컬 개발 중이라면 → ngrok 같은 툴로 터널 만들어서 →
  https://abc123.ngrok.io

  로컬에서 localhost:8000은 BizCrush 서버가 접근할 수 없으니 외부에서 접근
  가능한 URL이어야 합니다.

  지금 어떤 환경에서 테스트할 예정인가요? (로컬 vs 배포 서버)

❯ 해커톤이라 아마 로컬일거같은데                                             
                                                                             
⏺ 그럼 ngrok으로 임시 공개 URL 만들면 됩니다.                                
                                                                         
  설치 및 실행:                                                              
  # ngrok 설치 (Mac)                                                         
  brew install ngrok                                                         
                                                                             
  # ngrok 계정 연결 (https://ngrok.com 에서 토큰 발급)                       
  ngrok config add-authtoken YOUR_TOKEN                     
                                                 
  # FastAPI 서버 실행
  uvicorn main:app --reload

  # 다른 터미널에서 ngrok 실행
  ngrok http 8000

  그러면 이런 URL이 나와요:
  Forwarding  https://abc123.ngrok-free.app -> http://localhost:8000

  그 https://abc123.ngrok-free.app 을 .env의 BASE_URL에 넣으면 됩니다.

  단, ngrok 재시작할 때마다 URL이 바뀌니까 .env도 그때마다 업데이트해야 해요.