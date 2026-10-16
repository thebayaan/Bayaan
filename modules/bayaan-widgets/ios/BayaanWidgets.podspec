Pod::Spec.new do |s|
  s.name           = 'BayaanWidgets'
  s.version        = '0.1.0'
  s.summary        = 'Bayaan home screen widget bridge'
  s.author         = 'Bayaan'
  s.homepage       = 'https://thebayaan.com'
  s.license        = 'AGPL-3.0-or-later'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
