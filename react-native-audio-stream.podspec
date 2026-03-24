require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-audio-stream"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "16.0" }
  s.source       = { :git => "https://github.com/mustafakarali/react-native-audio-stream.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true

  s.frameworks   = "AVFoundation", "MediaPlayer", "AudioToolbox", "Network"
  s.weak_frameworks = "CarPlay"

  # Use install_modules_dependencies for RN 0.76+ compatibility
  # This handles both old arch (React-Core) and new arch (codegen, turbomodules) automatically
  install_modules_dependencies(s)
end