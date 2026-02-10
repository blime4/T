#!/usr/bin/env python3
"""Generate 4 enhanced Lottie animation JSON files for a cute cat desktop pet."""
from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple, Union

OUTPUT_DIR = "/LocalRun/shaobo.xie/2_Pytorch/docker/test/debug/T/neko-tts/src/assets"

# ---------------------------------------------------------------------------
# Primitive helpers
# ---------------------------------------------------------------------------

def rgba(r: float, g: float, b: float, a: float = 1.0) -> Dict[str, Any]:
    return {"a": 0, "k": [r, g, b, a]}


def static_val(val: Any) -> Dict[str, Any]:
    return {"a": 0, "k": val}


def animated_val(keyframes: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {"a": 1, "k": keyframes}


def kf(t: int, s: List, e: Optional[List] = None, hold: bool = False) -> Dict[str, Any]:
    """Single keyframe. If *e* is None the keyframe is a final hold."""
    frame: Dict[str, Any] = {"t": t, "s": s}
    if e is not None:
        frame["e"] = e
    if hold:
        frame["h"] = 1
    return frame


def ease_kf(t: int, s: List, e: Optional[List] = None) -> Dict[str, Any]:
    """Keyframe with ease-in / ease-out."""
    frame = kf(t, s, e)
    if e is not None:
        frame["i"] = {"x": [0.42], "y": [1]}
        frame["o"] = {"x": [0.58], "y": [0]}
    return frame


# ---------------------------------------------------------------------------
# Shape item builders
# ---------------------------------------------------------------------------

def ellipse_shape(name: str, pos: List, size: List) -> Dict[str, Any]:
    return {"ty": "el", "nm": name, "p": static_val(pos), "s": static_val(size), "d": 1}


def rect_shape(name: str, pos: List, size: List, r: float = 0) -> Dict[str, Any]:
    return {"ty": "rc", "nm": name, "p": static_val(pos), "s": static_val(size), "r": static_val(r), "d": 1}


def fill_shape(name: str, color: List, opacity: float = 100) -> Dict[str, Any]:
    return {"ty": "fl", "nm": name, "c": {"a": 0, "k": color[:3]}, "o": static_val(opacity), "r": 1, "bm": 0}


def stroke_shape(name: str, color: List, width: float = 1, opacity: float = 100) -> Dict[str, Any]:
    return {
        "ty": "st", "nm": name,
        "c": {"a": 0, "k": color[:3]},
        "o": static_val(opacity),
        "w": static_val(width),
        "lc": 2, "lj": 2, "bm": 0,
    }


def path_shape(name: str, vertices: List, in_pts: Optional[List] = None,
               out_pts: Optional[List] = None, closed: bool = False) -> Dict[str, Any]:
    n = len(vertices)
    _in = in_pts or [[0, 0]] * n
    _out = out_pts or [[0, 0]] * n
    return {
        "ty": "sh", "nm": name,
        "ks": static_val({"i": _in, "o": _out, "v": vertices, "c": closed}),
        "d": 1,
    }


def transform(
    pos: Any = None, anchor: Any = None, scale: Any = None,
    rotation: Any = None, opacity: Any = None,
) -> Dict[str, Any]:
    tr: Dict[str, Any] = {"ty": "tr"}
    tr["p"] = pos if (isinstance(pos, dict) and "a" in pos) else static_val(pos or [0, 0])
    tr["a"] = static_val(anchor or [0, 0])
    tr["s"] = scale if (isinstance(scale, dict) and "a" in scale) else static_val(scale or [100, 100])
    tr["r"] = rotation if (isinstance(rotation, dict) and "a" in rotation) else static_val(rotation or 0)
    if isinstance(opacity, dict) and "a" in opacity:
        tr["o"] = opacity
    else:
        tr["o"] = static_val(opacity if opacity is not None else 100)
    tr["sk"] = static_val(0)
    tr["sa"] = static_val(0)
    return tr


def group(name: str, items: List, tr: Optional[Dict] = None) -> Dict[str, Any]:
    it = list(items)
    it.append(tr or transform())
    return {"ty": "gr", "nm": name, "np": len(it), "it": it, "bm": 0, "cix": 2}


def shape_layer(
    name: str, ind: int, shapes: List,
    pos: Any = None, anchor: Any = None, scale: Any = None,
    rotation: Any = None, opacity: Any = None,
    ip: int = 0, op: int = 48,
) -> Dict[str, Any]:
    ks: Dict[str, Any] = {}

    # Position
    if isinstance(pos, dict) and "a" in pos:
        ks["p"] = pos
    elif isinstance(pos, list):
        ks["p"] = static_val(pos)
    else:
        ks["p"] = static_val([100, 100, 0])

    # Anchor
    ks["a"] = static_val(anchor or [0, 0, 0])

    # Scale
    if isinstance(scale, dict) and "a" in scale:
        ks["s"] = scale
    elif isinstance(scale, list):
        ks["s"] = static_val(scale)
    else:
        ks["s"] = static_val([100, 100, 100])

    # Rotation
    if isinstance(rotation, dict) and "a" in rotation:
        ks["r"] = rotation
    elif isinstance(rotation, (int, float)):
        ks["r"] = static_val(rotation)
    else:
        ks["r"] = static_val(0)

    # Opacity
    if isinstance(opacity, dict) and "a" in opacity:
        ks["o"] = opacity
    elif isinstance(opacity, (int, float)):
        ks["o"] = static_val(opacity)
    else:
        ks["o"] = static_val(100)

    return {
        "ty": 4, "nm": name, "ind": ind, "ddd": 0,
        "sr": 1, "ip": ip, "op": op, "st": 0,
        "bm": 0, "ks": ks, "ao": 0,
        "shapes": shapes,
    }


# ---------------------------------------------------------------------------
# Cat part builders
# ---------------------------------------------------------------------------

ORANGE = [0.95, 0.75, 0.3]
DARK_ORANGE = [0.85, 0.65, 0.2]
PINK_INNER = [0.95, 0.7, 0.7]
PINK_NOSE = [0.9, 0.5, 0.5]
BLACK = [0, 0, 0]
WHITE = [1, 1, 1]
BLUSH = [1, 0.75, 0.75]


def make_body_group(anim_tr: Optional[Dict] = None) -> Dict[str, Any]:
    """Orange ellipse body."""
    return group("Body", [
        ellipse_shape("BodyShape", [0, 0], [90, 75]),
        fill_shape("BodyFill", ORANGE),
    ], anim_tr or transform(pos=static_val([100, 130])))


def make_tail_group(anim_tr: Optional[Dict] = None) -> Dict[str, Any]:
    """Curved tail on the right side."""
    return group("Tail", [
        path_shape("TailPath",
                    vertices=[[0, 0], [15, -10], [30, -25], [25, -40]],
                    in_pts=[[0, 0], [-5, 5], [-5, 5], [5, 5]],
                    out_pts=[[5, -5], [5, -5], [5, -5], [0, 0]],
                    closed=False),
        stroke_shape("TailStroke", ORANGE, width=8),
    ], anim_tr or transform(pos=static_val([140, 150])))


def make_head_group(anim_tr: Optional[Dict] = None) -> Dict[str, Any]:
    """Orange circle head."""
    return group("Head", [
        ellipse_shape("HeadShape", [0, 0], [70, 65]),
        fill_shape("HeadFill", ORANGE),
    ], anim_tr or transform(pos=static_val([100, 80])))


def make_ear(name: str, cx: float, tip_y: float, base_left: float,
             base_right: float, base_y: float) -> Dict[str, Any]:
    """Triangle ear with pink inner."""
    outer = group(name + "Outer", [
        path_shape(name + "OuterPath",
                    vertices=[[cx, tip_y], [base_left, base_y], [base_right, base_y]],
                    closed=True),
        fill_shape(name + "OuterFill", ORANGE),
    ], transform())
    inner = group(name + "Inner", [
        path_shape(name + "InnerPath",
                    vertices=[[cx, tip_y + 6], [(base_left + cx) / 2 + 1, base_y - 3],
                              [(base_right + cx) / 2 - 1, base_y - 3]],
                    closed=True),
        fill_shape(name + "InnerFill", PINK_INNER),
    ], transform())
    return group(name, [outer, inner], transform())


def make_ears(left_tr: Optional[Dict] = None, right_tr: Optional[Dict] = None) -> List[Dict[str, Any]]:
    left = make_ear("LeftEar", cx=75, tip_y=38, base_left=62, base_right=88, base_y=62)
    right = make_ear("RightEar", cx=125, tip_y=38, base_left=112, base_right=138, base_y=62)
    if left_tr:
        left["it"][-1] = left_tr
    if right_tr:
        right["it"][-1] = right_tr
    return [left, right]


def make_eye(name: str, cx: float, cy: float, sx: float = 8, sy: float = 10,
             scale_override: Any = None) -> Dict[str, Any]:
    """Black ellipse eye with white highlight."""
    eye_el = group(name + "Pupil", [
        ellipse_shape(name + "EllShape", [0, 0], [sx, sy]),
        fill_shape(name + "Fill", BLACK),
    ], transform(pos=static_val([cx, cy])))
    highlight = group(name + "Highlight", [
        ellipse_shape(name + "HlShape", [0, 0], [3, 3]),
        fill_shape(name + "HlFill", WHITE),
    ], transform(pos=static_val([cx + 2, cy - 2])))
    tr = transform()
    if scale_override:
        tr["s"] = scale_override
    return group(name, [eye_el, highlight], tr)


def make_eyes_normal(blink_frames: Optional[List[Tuple[int, int]]] = None,
                     squint: bool = False) -> List[Dict[str, Any]]:
    """Return left and right eye groups."""
    eyes = []
    for nm, cx, hx in [("LeftEye", 88, 90), ("RightEye", 112, 114)]:
        sc = None
        if blink_frames:
            kfs = []
            for start, end in blink_frames:
                kfs.append(ease_kf(start, [100, 100], [100, 10]))
                kfs.append(ease_kf(start + (end - start) // 2, [100, 10], [100, 100]))
                kfs.append(kf(end, [100, 100]))
            sc = animated_val(kfs)
        elif squint:
            sc = static_val([100, 80])
        eyes.append(make_eye(nm, cx, 78, scale_override=sc))
    return eyes


def make_closed_eyes() -> List[Dict[str, Any]]:
    """Flat horizontal lines for sleeping eyes."""
    result = []
    for nm, cx in [("LeftClosedEye", 88), ("RightClosedEye", 112)]:
        result.append(group(nm, [
            path_shape(nm + "Line", vertices=[[cx - 5, 78], [cx + 5, 78]], closed=False),
            stroke_shape(nm + "Stroke", BLACK, width=2),
        ], transform()))
    return result


def make_nose() -> Dict[str, Any]:
    return group("Nose", [
        ellipse_shape("NoseShape", [0, 0], [6, 5]),
        fill_shape("NoseFill", PINK_NOSE),
    ], transform(pos=static_val([100, 85])))


def make_mouth_w() -> Dict[str, Any]:
    """W-shaped mouth using bezier path."""
    return group("Mouth", [
        path_shape("MouthPath",
                    vertices=[[93, 89], [96, 93], [100, 90], [104, 93], [107, 89]],
                    in_pts=[[0, 0], [-1, -1], [0, 1], [-1, -1], [0, 0]],
                    out_pts=[[1, 1], [0, -1], [1, 1], [0, -1], [0, 0]],
                    closed=False),
        stroke_shape("MouthStroke", BLACK, width=1.2),
    ], transform())


def make_open_mouth(anim_scale: Any = None) -> Dict[str, Any]:
    """Ellipse mouth for speaking animation."""
    tr = transform(pos=static_val([100, 92]))
    if anim_scale:
        tr["s"] = anim_scale
    return group("OpenMouth", [
        ellipse_shape("OpenMouthShape", [0, 0], [10, 8]),
        fill_shape("OpenMouthFill", [0.85, 0.4, 0.4]),
    ], tr)


def make_whiskers() -> List[Dict[str, Any]]:
    """6 whiskers, 3 each side."""
    whiskers = []
    # Left whiskers
    for i, (y_off, angle) in enumerate([(0, 0), (-4, -5), (4, 5)]):
        whiskers.append(group("LWhisker%d" % i, [
            path_shape("LW%dPath" % i,
                        vertices=[[82, 87 + y_off], [55, 85 + y_off + angle]],
                        closed=False),
            stroke_shape("LW%dStroke" % i, BLACK, width=0.8),
        ], transform()))
    # Right whiskers
    for i, (y_off, angle) in enumerate([(0, 0), (-4, -5), (4, 5)]):
        whiskers.append(group("RWhisker%d" % i, [
            path_shape("RW%dPath" % i,
                        vertices=[[118, 87 + y_off], [145, 85 + y_off + angle]],
                        closed=False),
            stroke_shape("RW%dStroke" % i, BLACK, width=0.8),
        ], transform()))
    return whiskers


def make_blush() -> List[Dict[str, Any]]:
    return [
        group("LeftBlush", [
            ellipse_shape("LBlushShape", [0, 0], [12, 8]),
            fill_shape("LBlushFill", BLUSH, opacity=40),
        ], transform(pos=static_val([82, 90]))),
        group("RightBlush", [
            ellipse_shape("RBlushShape", [0, 0], [12, 8]),
            fill_shape("RBlushFill", BLUSH, opacity=40),
        ], transform(pos=static_val([118, 90]))),
    ]


def make_paws() -> List[Dict[str, Any]]:
    return [
        group("LeftPaw", [
            ellipse_shape("LPawShape", [0, 0], [22, 14]),
            fill_shape("LPawFill", ORANGE),
        ], transform(pos=static_val([82, 162]))),
        group("RightPaw", [
            ellipse_shape("RPawShape", [0, 0], [22, 14]),
            fill_shape("RPawFill", ORANGE),
        ], transform(pos=static_val([118, 162]))),
    ]


def make_forehead_stripes() -> List[Dict[str, Any]]:
    stripes = []
    for i, cx in enumerate([95, 100, 105]):
        stripes.append(group("Stripe%d" % i, [
            path_shape("Stripe%dPath" % i,
                        vertices=[[cx, 62], [cx - 1, 55], [cx, 50]],
                        in_pts=[[0, 0], [0, 2], [0, 0]],
                        out_pts=[[0, -2], [0, -2], [0, 0]],
                        closed=False),
            stroke_shape("Stripe%dStroke" % i, DARK_ORANGE, width=2),
        ], transform()))
    return stripes


# ---------------------------------------------------------------------------
# Lottie document builder
# ---------------------------------------------------------------------------

def lottie_doc(name: str, op: int, layers: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "v": "5.7.4",
        "fr": 24,
        "ip": 0,
        "op": op,
        "w": 200,
        "h": 200,
        "nm": name,
        "ddd": 0,
        "assets": [],
        "layers": layers,
    }


# ---------------------------------------------------------------------------
# Animation: IDLE
# ---------------------------------------------------------------------------

def build_idle() -> Dict[str, Any]:
    op = 48

    # Body with breathing
    body_tr = transform(
        pos=static_val([100, 130]),
        scale=animated_val([
            ease_kf(0, [100, 100], [100, 97]),
            ease_kf(24, [100, 97], [100, 100]),
            kf(48, [100, 100]),
        ]),
    )

    # Tail sway
    tail_tr = transform(
        pos=static_val([140, 150]),
        rotation=animated_val([
            ease_kf(0, [-5], [5]),
            ease_kf(24, [5], [-5]),
            kf(48, [-5]),
        ]),
    )

    # Ear twitch (left ear)
    left_ear_tr = transform(
        rotation=animated_val([
            kf(0, [0]),
            ease_kf(36, [0], [-4]),
            ease_kf(40, [-4], [0]),
            kf(48, [0]),
        ]),
    )

    ears = make_ears(left_tr=left_ear_tr)
    eyes = make_eyes_normal(blink_frames=[(30, 34)])

    shapes: List[Dict[str, Any]] = []
    shapes.append(make_body_group(body_tr))
    shapes.append(make_tail_group(tail_tr))
    shapes.extend(make_paws())
    shapes.append(make_head_group())
    shapes.extend(ears)
    shapes.extend(make_forehead_stripes())
    shapes.extend(eyes)
    shapes.append(make_nose())
    shapes.append(make_mouth_w())
    shapes.extend(make_whiskers())
    shapes.extend(make_blush())

    layer = shape_layer("CatIdle", 1, shapes, pos=[100, 100, 0], ip=0, op=op)
    return lottie_doc("cat-idle", op, [layer])


# ---------------------------------------------------------------------------
# Animation: SPEAKING
# ---------------------------------------------------------------------------

def build_speaking() -> Dict[str, Any]:
    op = 24

    # Body bounce
    body_tr = transform(
        pos=animated_val([
            ease_kf(0, [100, 130], [100, 128]),
            ease_kf(6, [100, 128], [100, 130]),
            ease_kf(12, [100, 130], [100, 128]),
            ease_kf(18, [100, 128], [100, 130]),
            kf(24, [100, 130]),
        ]),
    )

    # Tail wags faster
    tail_tr = transform(
        pos=static_val([140, 150]),
        rotation=animated_val([
            ease_kf(0, [-10], [10]),
            ease_kf(12, [10], [-10]),
            kf(24, [-10]),
        ]),
    )

    # Open mouth animation
    mouth_scale = animated_val([
        ease_kf(0, [100, 0], [100, 100]),
        ease_kf(6, [100, 100], [100, 0]),
        ease_kf(12, [100, 0], [100, 100]),
        ease_kf(18, [100, 100], [100, 0]),
        kf(24, [100, 0]),
    ])

    ears = make_ears()
    eyes = make_eyes_normal(squint=True)

    shapes: List[Dict[str, Any]] = []
    shapes.append(make_body_group(body_tr))
    shapes.append(make_tail_group(tail_tr))
    shapes.extend(make_paws())
    shapes.append(make_head_group())
    shapes.extend(ears)
    shapes.extend(make_forehead_stripes())
    shapes.extend(eyes)
    shapes.append(make_nose())
    shapes.append(make_open_mouth(anim_scale=mouth_scale))
    shapes.extend(make_whiskers())
    shapes.extend(make_blush())

    layer = shape_layer("CatSpeaking", 1, shapes, pos=[100, 100, 0], ip=0, op=op)
    return lottie_doc("cat-speaking", op, [layer])


# ---------------------------------------------------------------------------
# Animation: LISTENING
# ---------------------------------------------------------------------------

def build_listening() -> Dict[str, Any]:
    op = 48

    # Body breathing
    body_tr = transform(
        pos=static_val([100, 130]),
        scale=animated_val([
            ease_kf(0, [100, 100], [100, 98]),
            ease_kf(24, [100, 98], [100, 100]),
            kf(48, [100, 100]),
        ]),
    )

    # Tail gentle sway
    tail_tr = transform(
        pos=static_val([140, 150]),
        rotation=animated_val([
            ease_kf(0, [-3], [3]),
            ease_kf(24, [3], [-3]),
            kf(48, [-3]),
        ]),
    )

    # Head tilt
    head_tr = transform(
        pos=static_val([100, 80]),
        rotation=animated_val([
            ease_kf(0, [0], [3]),
            ease_kf(12, [3], [0]),
            ease_kf(24, [0], [-3]),
            ease_kf(36, [-3], [0]),
            kf(48, [0]),
        ]),
    )

    # Right ear perks up
    right_ear_tr = transform(
        pos=animated_val([
            ease_kf(0, [0, 0], [0, -5]),
            ease_kf(24, [0, -5], [0, 0]),
            kf(48, [0, 0]),
        ]),
    )

    # Eyes bigger
    eye_scale = animated_val([
        ease_kf(0, [100, 100], [120, 120]),
        ease_kf(24, [120, 120], [100, 100]),
        kf(48, [100, 100]),
    ])

    ears = make_ears(right_tr=right_ear_tr)

    eyes = []
    for nm, cx, hx in [("LeftEye", 88, 90), ("RightEye", 112, 114)]:
        eyes.append(make_eye(nm, cx, 78, scale_override=eye_scale))

    shapes: List[Dict[str, Any]] = []
    shapes.append(make_body_group(body_tr))
    shapes.append(make_tail_group(tail_tr))
    shapes.extend(make_paws())
    shapes.append(make_head_group(head_tr))
    shapes.extend(ears)
    shapes.extend(make_forehead_stripes())
    shapes.extend(eyes)
    shapes.append(make_nose())
    shapes.append(make_mouth_w())
    shapes.extend(make_whiskers())
    shapes.extend(make_blush())

    layer = shape_layer("CatListening", 1, shapes, pos=[100, 100, 0], ip=0, op=op)
    return lottie_doc("cat-listening", op, [layer])


# ---------------------------------------------------------------------------
# Animation: SLEEPING
# ---------------------------------------------------------------------------

def build_sleeping() -> Dict[str, Any]:
    op = 72

    # Body slow breathing
    body_tr = transform(
        pos=animated_val([
            ease_kf(0, [100, 130], [100, 131]),
            ease_kf(36, [100, 131], [100, 130]),
            kf(72, [100, 130]),
        ]),
        scale=animated_val([
            ease_kf(0, [100, 100], [100, 95]),
            ease_kf(36, [100, 95], [100, 100]),
            kf(72, [100, 100]),
        ]),
    )

    # Tail curled, barely moving
    tail_tr = transform(
        pos=static_val([140, 150]),
        rotation=animated_val([
            ease_kf(0, [-2], [2]),
            ease_kf(36, [2], [-2]),
            kf(72, [-2]),
        ]),
    )

    # Head droops
    head_tr = transform(
        pos=animated_val([
            ease_kf(0, [100, 80], [100, 83]),
            ease_kf(36, [100, 83], [100, 80]),
            kf(72, [100, 80]),
        ]),
    )

    ears = make_ears()
    closed_eyes = make_closed_eyes()

    shapes: List[Dict[str, Any]] = []
    shapes.append(make_body_group(body_tr))
    shapes.append(make_tail_group(tail_tr))
    shapes.extend(make_paws())
    shapes.append(make_head_group(head_tr))
    shapes.extend(ears)
    shapes.extend(make_forehead_stripes())
    shapes.extend(closed_eyes)
    shapes.append(make_nose())
    shapes.append(make_mouth_w())
    shapes.extend(make_whiskers())
    shapes.extend(make_blush())

    layers = [shape_layer("CatSleeping", 1, shapes, pos=[100, 100, 0], ip=0, op=op)]

    # Z text layers floating up with staggered timing
    for i, (start_frame, x_pos) in enumerate([(0, 135), (10, 145), (20, 155)]):
        z_shapes = [
            group("Z%d" % i, [
                path_shape("Z%dPath" % i,
                            vertices=[[-4, -4], [4, -4], [-4, 4], [4, 4]],
                            closed=False),
                stroke_shape("Z%dStroke" % i, [0.4, 0.4, 0.7], width=1.5),
            ], transform()),
        ]
        z_layer = shape_layer(
            "Zzz%d" % i, i + 2, z_shapes,
            pos=animated_val([
                ease_kf(start_frame, [x_pos, 60, 0], [x_pos, 30, 0]),
                kf(start_frame + 48, [x_pos, 30, 0]),
            ]),
            opacity=animated_val([
                ease_kf(start_frame, [100], [0]),
                kf(start_frame + 48, [0]),
            ]),
            scale=animated_val([
                ease_kf(start_frame, [60 + i * 15, 60 + i * 15, 100], [100 + i * 15, 100 + i * 15, 100]),
                kf(start_frame + 48, [100 + i * 15, 100 + i * 15, 100]),
            ]),
            ip=0, op=op,
        )
        layers.append(z_layer)

    return lottie_doc("cat-sleeping", op, layers)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    animations = {
        "cat-idle.json": build_idle,
        "cat-speaking.json": build_speaking,
        "cat-listening.json": build_listening,
        "cat-sleeping.json": build_sleeping,
    }

    for filename, builder in animations.items():
        filepath = os.path.join(OUTPUT_DIR, filename)
        data = builder()
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        size = len(json.dumps(data))
        print("Generated: %s  (%d bytes)" % (filepath, size))

    print("\nAll 4 Lottie animation files generated successfully.")


if __name__ == "__main__":
    main()
