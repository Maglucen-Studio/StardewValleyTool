from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parents[1]
branding = root / "branding"
desktop_output = root / "desktop" / "resources"
public_output = root / "public"
source = branding / "maglucen-stardew-companion-mark-master.png"

desktop_output.mkdir(parents=True, exist_ok=True)
public_output.mkdir(parents=True, exist_ok=True)

master = Image.open(source).convert("RGBA")
bounds = master.getchannel("A").getbbox()
if not bounds:
    raise RuntimeError(f"Brand mark is fully transparent: {source}")

mark = master.crop(bounds)


def render(size: int, padding: int) -> Image.Image:
    available = size - padding * 2
    ratio = min(available / mark.width, available / mark.height)
    dimensions = (
        max(1, round(mark.width * ratio)),
        max(1, round(mark.height * ratio)),
    )
    resized = mark.resize(dimensions, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(
        resized,
        ((size - resized.width) // 2, (size - resized.height) // 2),
    )
    return canvas


app_icon = render(512, 32)
app_icon.save(desktop_output / "icon.png", optimize=True)
app_icon.save(public_output / "app-icon.png", optimize=True)

favicon = render(64, 3)
favicon.save(public_output / "favicon.png", optimize=True)

ico_sizes = (16, 24, 32, 48, 64, 128, 256)
ico_master = render(256, 10)
ico_master.save(
    desktop_output / "icon.ico",
    sizes=[(size, size) for size in ico_sizes],
)
