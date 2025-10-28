#!/bin/bash

# Simple build script to create uber JAR without Maven

set -e

echo "Building FIT Zone Parser Uber JAR..."
echo

# Clean previous builds
rm -rf build
mkdir -p build/classes
mkdir -p build/jar-contents

# Compile Java source
echo "1. Compiling Java source..."
javac -cp fit.jar \
    -d build/classes \
    src/main/java/com/cyclingai/FitZoneParser.java

# Extract FIT SDK JAR contents
echo "2. Extracting FIT SDK JAR..."
cd build/jar-contents
jar xf ../../fit.jar
cd ../..

# Copy compiled classes into jar-contents
echo "3. Merging compiled classes..."
cp -r build/classes/* build/jar-contents/

# Create manifest
echo "4. Creating manifest..."
cat > build/jar-contents/META-INF/MANIFEST.MF << 'EOF'
Manifest-Version: 1.0
Main-Class: com.cyclingai.FitZoneParser
Created-By: Cycling AI Analysis
EOF

# Create uber JAR
echo "5. Creating uber JAR..."
cd build/jar-contents
jar cfm ../FitZoneParser.jar META-INF/MANIFEST.MF .
cd ../..

# Copy to lib directory
echo "6. Copying to lib directory..."
mkdir -p ../lib
cp build/FitZoneParser.jar ../lib/FitZoneParser.jar

echo
echo "✅ Build complete!"
echo "   Output: ../lib/FitZoneParser.jar"
echo
echo "Test with:"
echo "   java -jar ../lib/FitZoneParser.jar <fit-file-path> <ftp-watts>"
