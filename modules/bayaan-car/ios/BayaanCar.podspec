Pod::Spec.new do |s|
  s.name           = 'BayaanCar'
  s.version        = '1.0.0'
  s.summary        = 'CarPlay integration for Bayaan'
  s.author         = 'Bayaan'
  s.homepage       = 'https://thebayaan.com'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks     = 'CarPlay', 'MediaPlayer'
  s.source_files   = '**/*.swift'
  # Icon tiles from scripts/generate-car-icon-tiles.ts.
  s.resource_bundles = { 'BayaanCarIcons' => ['icons/*.png'] }
end
