#!/bin/bash
npm run compile
vsce package
code --install-extension *.vsix --force
echo "Extension installed! Please reload VSCode."
