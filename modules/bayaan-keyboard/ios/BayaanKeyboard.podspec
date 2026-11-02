Pod::Spec.new do |s|
  s.name           = 'BayaanKeyboard'
  s.version        = '1.0.0'
  s.summary        = 'iPad keyboard shortcuts and pointer hover for Bayaan'
  s.author         = 'Bayaan'
  s.homepage       = 'https://thebayaan.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  # RCTSetDispatchW3CPointerEvents, for hover.
  s.dependency 'React-Core'
  s.source_files   = '**/*.swift'
end
