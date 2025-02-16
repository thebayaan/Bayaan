#!/bin/bash

# iOS
mkdir -p ios/Bayaan/Images.xcassets/Calligraphy.imageset
cp assets/calligraphy-light.png ios/Bayaan/Images.xcassets/Calligraphy.imageset/
cp assets/calligraphy-dark.png ios/Bayaan/Images.xcassets/Calligraphy.imageset/

# Android
mkdir -p android/app/src/main/res/drawable
mkdir -p android/app/src/main/res/drawable-night
cp assets/calligraphy-light.png android/app/src/main/res/drawable/calligraphy_light.png
cp assets/calligraphy-dark.png android/app/src/main/res/drawable/calligraphy_dark.png
