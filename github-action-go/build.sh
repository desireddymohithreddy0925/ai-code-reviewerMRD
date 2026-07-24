#!/bin/bash
set -e

echo "Compiling RepoSage Go Runner..."

mkdir -p ../github-action/bin

# Linux
GOOS=linux GOARCH=amd64 go build -o ../github-action/bin/reposage-linux-amd64 main.go
GOOS=linux GOARCH=arm64 go build -o ../github-action/bin/reposage-linux-arm64 main.go

# macOS
GOOS=darwin GOARCH=amd64 go build -o ../github-action/bin/reposage-darwin-amd64 main.go
GOOS=darwin GOARCH=arm64 go build -o ../github-action/bin/reposage-darwin-arm64 main.go

# Windows
GOOS=windows GOARCH=amd64 go build -o ../github-action/bin/reposage-windows-amd64.exe main.go

echo "✅ Compilation complete!"
