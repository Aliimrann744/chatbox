#!/bin/bash
# Fix C++ STL linking for native modules on Windows
# Adds c++_shared to target_link_libraries in CMakeLists.txt files

fix_cmake() {
  local file="$1"
  local target="$2"
  if [ -f "$file" ] && ! grep -q "c++_shared" "$file"; then
    # Add c++_shared after the target_link_libraries line containing the target
    sed -i "s/target_link_libraries(${target}/target_link_libraries(${target}\n            c++_shared/" "$file"
    echo "Patched: $file"
  fi
}

# react-native-screens
fix_cmake "node_modules/react-native-screens/android/CMakeLists.txt" "rnscreens"

# react-native-worklets  
fix_cmake "node_modules/react-native-worklets/android/CMakeLists.txt" "worklets"

# expo-modules-core
fix_cmake "node_modules/expo-modules-core/android/CMakeLists.txt" "expo-modules-core"

echo "Done patching CMake files"
