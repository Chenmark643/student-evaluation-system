#!/bin/bash
# ============================================================================
# 顿河学院学生测评管理软件 — macOS Setup & Build Script
# ============================================================================
# Usage:
#   chmod +x setup_mac.sh
#   ./setup_mac.sh            # interactive setup + build
#   ./setup_mac.sh build      # build only (deps already installed)
#   ./setup_mac.sh run        # run in dev mode (no build)
#   ./setup_mac.sh clean      # remove build artifacts
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="顿河学院学生测评管理软件"
PYTHON_MIN="3.10"

# ── colours ──────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
err()   { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── prerequisites check ──────────────────────────────────────────────
check_python() {
    if command -v python3 &>/dev/null; then
        PYTHON=python3
    elif command -v python &>/dev/null; then
        PYTHON=python
    else
        err "Python 3 not found. Install from https://www.python.org/downloads/"
    fi

    PY_VER=$($PYTHON --version 2>&1 | awk '{print $2}')
    info "Found Python $PY_VER"
}

check_chrome() {
    if [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]; then
        info "Chrome found — app will use Chrome for best experience"
    else
        warn "Chrome not found — app will fall back to Safari"
        warn "Install Chrome for the best experience: https://www.google.com/chrome/"
    fi
}

# ── icon conversion (png → icns) ─────────────────────────────────────
convert_icon() {
    if [ -f "logo.icns" ]; then
        info "logo.icns already exists, skipping"
        return
    fi

    # Try to find a source image
    PNG=""
    for f in "logo.png" "../logo.png" "icon.png"; do
        [ -f "$f" ] && PNG="$f" && break
    done

    if [ -z "$PNG" ]; then
        warn "No PNG icon found. App will be built without custom icon."
        warn "To add one later: drop a 1024×1024 PNG named 'logo.png' and re-run this script."
        return
    fi

    info "Converting $PNG → logo.icns ..."
    mkdir -p logo.iconset
    sips -z 16 16     "$PNG" --out logo.iconset/icon_16x16.png       2>/dev/null
    sips -z 32 32     "$PNG" --out logo.iconset/icon_16x16@2x.png    2>/dev/null
    sips -z 32 32     "$PNG" --out logo.iconset/icon_32x32.png       2>/dev/null
    sips -z 64 64     "$PNG" --out logo.iconset/icon_32x32@2x.png    2>/dev/null
    sips -z 128 128   "$PNG" --out logo.iconset/icon_128x128.png     2>/dev/null
    sips -z 256 256   "$PNG" --out logo.iconset/icon_128x128@2x.png  2>/dev/null
    sips -z 256 256   "$PNG" --out logo.iconset/icon_256x256.png     2>/dev/null
    sips -z 512 512   "$PNG" --out logo.iconset/icon_256x256@2x.png  2>/dev/null
    sips -z 512 512   "$PNG" --out logo.iconset/icon_512x512.png     2>/dev/null
    sips -z 1024 1024 "$PNG" --out logo.iconset/icon_512x512@2x.png  2>/dev/null
    iconutil -c icns logo.iconset
    rm -rf logo.iconset
    info "logo.icns created"
}

# ── install dependencies ─────────────────────────────────────────────
install_deps() {
    info "Installing Python dependencies..."
    $PYTHON -m pip install --upgrade pip

    # Core deps
    $PYTHON -m pip install eel pandas openpyxl xlrd bottle bottle-websocket

    # Eel needs gevent for websocket support
    $PYTHON -m pip install gevent gevent-websocket

    # Optional: Pillow for DMG background image (harmless if missing)
    $PYTHON -m pip install Pillow 2>/dev/null || warn "Pillow skipped (DMG will have default background)"

    # PyInstaller for building
    $PYTHON -m pip install pyinstaller

    info "All dependencies installed"
}

# ── build ────────────────────────────────────────────────────────────
do_build() {
    convert_icon

    info "Building $APP_NAME.app ..."
    $PYTHON -m PyInstaller --clean build_mac.spec

    if [ -d "dist/${APP_NAME}.app" ]; then
        info "Build successful!"
        echo ""
        echo "  App: $(pwd)/dist/${APP_NAME}.app"
        echo ""
        echo "  To run:  open dist/${APP_NAME}.app"
        echo "  Or drag  dist/${APP_NAME}.app → /Applications"
        echo ""

        # ── Create a professional DMG for distribution ─────────────────
        create_dmg
    else
        err "Build failed — check PyInstaller output above"
    fi
}

# ── DMG creation ─────────────────────────────────────────────────────
create_dmg() {
    local DMG_NAME="${APP_NAME}.dmg"
    local DMG_PATH="dist/${DMG_NAME}"
    local STAGING="dist/.dmg_staging"

    info "Creating DMG: ${DMG_NAME} ..."

    rm -f "$DMG_PATH"
    rm -rf "$STAGING"
    mkdir -p "$STAGING"

    # Copy .app into staging
    cp -R "dist/${APP_NAME}.app" "$STAGING/"

    # Create symlink to /Applications (for drag-and-drop install)
    ln -s /Applications "$STAGING/Applications"

    # ── Create a simple background image (gradient + hint text) ──────
    # Uses built-in Python to generate a PNG background (no extra tools needed)
    $PYTHON - "$STAGING" << 'PYEOF'
import sys, os
staging = sys.argv[1]
bg_path = os.path.join(staging, 'dmg_bg.png')

# Create a subtle gradient background 660×400
# If PIL/Pillow not available, skip background (DMG works fine without)
try:
    from PIL import Image, ImageDraw, ImageFont
    w, h = 660, 400
    img = Image.new('RGB', (w, h), color=(245, 245, 248))
    draw = ImageDraw.Draw(img)
    # Subtle top gradient bar
    for i in range(120):
        c = 240 - i // 3
        draw.line([(0, i), (w, i)], fill=(c, c, 252))

    # Arrow + hint text
    try:
        font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 22, index=2)
        font_sm = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 13, index=2)
    except Exception:
        font = ImageFont.load_default()
        font_sm = ImageFont.load_default()

    draw.text((160, 280), "←  拖到 Applications 文件夹即可安装",
              fill=(80, 80, 90), font=font)
    draw.text((270, 230), "顿河学院学生测评管理软件",
              fill=(60, 60, 72), font=font_sm)
    img.save(bg_path)
    print("DMG background created")
except ImportError:
    # No PIL — DMG still works, just no custom background
    open(bg_path, 'w').close()  # placeholder
    print("Pillow not installed — DMG will have default background")
PYEOF

    # ── Create the DMG ──────────────────────────────────────────────
    hdiutil create \
        -volname "${APP_NAME}" \
        -srcfolder "$STAGING" \
        -ov -format UDRW \
        "${STAGING}.dmg" \
        -fs HFS+ \
        -size 600M 2>/dev/null

    # Mount the DMG to customize layout
    local DEV
    DEV=$(hdiutil attach "${STAGING}.dmg" -nobrowse -noautoopen 2>/dev/null | grep '/dev/' | head -1 | awk '{print $1}')
    if [ -n "$DEV" ]; then
        local VOL="/Volumes/${APP_NAME}"

        # Set custom layout via AppleScript
        osascript << APPLESCRIPT
tell application "Finder"
    tell disk "${APP_NAME}"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {200, 150, 860, 550}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 80
        set background picture of viewOptions to file ".background:dmg_bg.png"
        -- Position icons
        set position of item "${APP_NAME}.app" to {160, 160}
        set position of item "Applications" to {420, 160}
        close
        open
        update without registering applications
        delay 1
    end tell
end tell
APPLESCRIPT

        # Move background to hidden folder
        mkdir -p "${VOL}/.background" 2>/dev/null
        cp "${STAGING}/dmg_bg.png" "${VOL}/.background/" 2>/dev/null

        # Set DMG window properties
        osascript << APPLESCRIPT2
tell application "Finder"
    tell disk "${APP_NAME}"
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {200, 150, 860, 550}
        update without registering applications
    end tell
end tell
APPLESCRIPT2
        sleep 1

        hdiutil detach "$DEV" -quiet -force 2>/dev/null
    fi

    # Convert to compressed read-only DMG
    hdiutil convert "${STAGING}.dmg" \
        -format UDZO \
        -imagekey zlib-level=9 \
        -o "$DMG_PATH" 2>/dev/null

    # Clean up
    rm -rf "$STAGING" "${STAGING}.dmg"

    info "DMG created: ${DMG_PATH}"
    echo ""
    echo "  分发文件: dist/${DMG_NAME}"
    echo "  用户只需打开 DMG，拖入 Applications 即可安装"
    echo ""
}

# ── run dev mode ─────────────────────────────────────────────────────
do_run() {
    info "Starting in development mode..."
    $PYTHON main.py
}

# ── clean ────────────────────────────────────────────────────────────
do_clean() {
    info "Cleaning build artifacts..."
    rm -rf build dist *.spec.bak logo.icns logo.iconset
    find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true
    find . -type f -name '*.pyc' -delete 2>/dev/null || true
    info "Clean complete"
}

# ── main ─────────────────────────────────────────────────────────────
main() {
    echo ""
    echo "╔══════════════════════════════════════════════╗"
    echo "║   ${APP_NAME}  ║"
    echo "║   macOS Setup & Build                       ║"
    echo "╚══════════════════════════════════════════════╝"
    echo ""

    check_python
    check_chrome

    case "${1:-setup}" in
        build)
            install_deps
            do_build
            ;;
        run)
            do_run
            ;;
        clean)
            do_clean
            ;;
        setup|*)
            install_deps
            do_build
            ;;
    esac

    echo ""
    info "Done! ✨"
}

main "${@}"
