// Original Herald OS theme palettes, MIT; see LICENSE.
import type { ThemeSpec } from "./theme";
export const heraldThemes: ThemeSpec[] = [
  {
    "name": "herald-cloud",
    "label": "Herald Cloud",
    "description": "Cool, bright and calm, with a clear blue accent.",
    "shell": {
      "scheme": "light"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#eef2f8",
      "bg2": "#e2e8f2",
      "surface": "#f8fafd",
      "fg": "#161c28",
      "fg_dim": "#5a6478",
      "accent": "#2f6fe0",
      "accent_strong": "#2459b8",
      "border_inactive": "#cdd6e4",
      "border_active": "#2f6fe0",
      "urgent": "#c13b3b",
      "ok": "#1f8a5c",
      "warn": "#a1660f"
    },
    "gtk": {
      "color_scheme": "default",
      "theme": "Adwaita"
    },
    "terminal": {
      "background": "#eef2f8",
      "foreground": "#161c28",
      "cursor": "#2459b8",
      "palette": [
        "#2c313d",
        "#a52727",
        "#27a551",
        "#a58627",
        "#275ba5",
        "#9027a5",
        "#279ba5",
        "#b8bdc4",
        "#626771",
        "#d02525",
        "#25d05e",
        "#d0a525",
        "#256cd0",
        "#b425d0",
        "#25c2d0",
        "#e1e5ec"
      ]
    }
  },
  {
    "name": "herald-dusk",
    "label": "Herald Dusk",
    "description": "Twilight violet with a soft lilac accent.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#120c1c",
      "bg2": "#1f1430",
      "surface": "#251939",
      "fg": "#f1eafa",
      "fg_dim": "#ab9dc4",
      "accent": "#c77dff",
      "accent_strong": "#d89bff",
      "border_inactive": "#34274b",
      "border_active": "#c77dff",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#120c1c",
      "foreground": "#f1eafa",
      "cursor": "#d89bff",
      "palette": [
        "#3a3444",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#dbd4e4",
        "#676070",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-ember",
    "label": "Herald Ember",
    "description": "Warm charcoal with a glowing orange accent.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#140c0a",
      "bg2": "#24130e",
      "surface": "#2c1812",
      "fg": "#f6ece6",
      "fg_dim": "#bba196",
      "accent": "#ff7a45",
      "accent_strong": "#ff9466",
      "border_inactive": "#3d241a",
      "border_active": "#ff7a45",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#140c0a",
      "foreground": "#f6ece6",
      "cursor": "#ff9466",
      "palette": [
        "#3d3432",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#dfd6d0",
        "#6a615e",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-forest",
    "label": "Herald Forest",
    "description": "Deep green, like a walk under pines.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#08130e",
      "bg2": "#10241a",
      "surface": "#15291f",
      "fg": "#e8f3ec",
      "fg_dim": "#97b5a4",
      "accent": "#46c58a",
      "accent_strong": "#64d9a2",
      "border_inactive": "#1e3b2c",
      "border_active": "#46c58a",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#08130e",
      "foreground": "#e8f3ec",
      "cursor": "#64d9a2",
      "palette": [
        "#303b36",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#d2ddd6",
        "#5d6862",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-graphite",
    "label": "Herald Graphite",
    "description": "Neutral dark with a gold accent; the original alpha look.",
    "shell": {
      "theme": "graphite",
      "accent": "blue"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#07080a",
      "bg2": "#11141a",
      "surface": "#171b22",
      "fg": "#ececec",
      "fg_dim": "#9aa0ab",
      "accent": "#e6b84a",
      "accent_strong": "#f2c85c",
      "border_active": "#e6b84a",
      "border_inactive": "#2a2f38",
      "urgent": "#ff6b6b",
      "ok": "#36e6a6",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#07080a",
      "foreground": "#ececec",
      "cursor": "#f2c85c",
      "palette": [
        "#171b22",
        "#ff6d6d",
        "#36e6a6",
        "#f2c25e",
        "#6aa6ff",
        "#b47cff",
        "#4cc2ff",
        "#ececec",
        "#2a2f38",
        "#ff8a8a",
        "#6fffc4",
        "#ffd67a",
        "#9cc3ff",
        "#c9a0ff",
        "#8ad9ff",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-ice",
    "label": "Herald Ice",
    "description": "Ocean with a cool cyan accent.",
    "shell": {
      "theme": "ocean",
      "accent": "ice"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#04113f",
      "bg2": "#0a2a96",
      "surface": "#0b1c5a",
      "fg": "#e9eefb",
      "fg_dim": "#9fb0dc",
      "accent": "#4cc2ff",
      "accent_strong": "#7ad3ff",
      "border_active": "#4cc2ff",
      "border_inactive": "#1c2c66",
      "urgent": "#ff6b6b",
      "ok": "#36e6a6",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#050f33",
      "foreground": "#e9eefb",
      "cursor": "#7ad3ff",
      "palette": [
        "#0b1c5a",
        "#ff6d6d",
        "#36e6a6",
        "#f2c25e",
        "#4cc2ff",
        "#b47cff",
        "#7ad3ff",
        "#e9eefb",
        "#2a3a7a",
        "#ff8a8a",
        "#6fffc4",
        "#ffd67a",
        "#8ad9ff",
        "#c9a0ff",
        "#a8e4ff",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-lagoon",
    "label": "Herald Lagoon",
    "description": "Deep teal water with an aqua accent.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#04161a",
      "bg2": "#072a30",
      "surface": "#0b2f37",
      "fg": "#e6f6f7",
      "fg_dim": "#91bbbf",
      "accent": "#2fd1c5",
      "accent_strong": "#58e1d7",
      "border_inactive": "#13424b",
      "border_active": "#2fd1c5",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#04161a",
      "foreground": "#e6f6f7",
      "cursor": "#58e1d7",
      "palette": [
        "#2d3e42",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#cfe0e1",
        "#5a6b6e",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-ocean",
    "label": "Herald Ocean",
    "description": "Deep blue glass on a living wallpaper. The default.",
    "shell": {
      "theme": "ocean",
      "accent": "blue"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#04113f",
      "bg2": "#0a2a96",
      "surface": "#0b1c5a",
      "fg": "#e9eefb",
      "fg_dim": "#9fb0dc",
      "accent": "#4d92ff",
      "accent_strong": "#5296ff",
      "border_active": "#4d92ff",
      "border_inactive": "#1c2c66",
      "urgent": "#ff6b6b",
      "ok": "#36e6a6",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#050f33",
      "foreground": "#e9eefb",
      "cursor": "#5296ff",
      "palette": [
        "#0b1c5a",
        "#ff6d6d",
        "#36e6a6",
        "#f2c25e",
        "#5296ff",
        "#b47cff",
        "#4cc2ff",
        "#e9eefb",
        "#2a3a7a",
        "#ff8a8a",
        "#6fffc4",
        "#ffd67a",
        "#7fb0ff",
        "#c9a0ff",
        "#8ad9ff",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-onyx",
    "label": "Herald Onyx",
    "description": "True black for OLED screens, with quiet silver highlights.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#000000",
      "bg2": "#0b0b0c",
      "surface": "#141416",
      "fg": "#f2f2f3",
      "fg_dim": "#909096",
      "accent": "#d9dbe0",
      "accent_strong": "#ffffff",
      "border_inactive": "#26262a",
      "border_active": "#d9dbe0",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#000000",
      "foreground": "#f2f2f3",
      "cursor": "#ffffff",
      "palette": [
        "#2c2c2c",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#dadadb",
        "#5c5c5c",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-paper",
    "label": "Herald Paper",
    "description": "Warm off-white, like good paper, with a terracotta accent.",
    "shell": {
      "scheme": "light"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#f5f2ea",
      "bg2": "#ece6d8",
      "surface": "#fbf9f4",
      "fg": "#24211b",
      "fg_dim": "#6b6455",
      "accent": "#b0532a",
      "accent_strong": "#94431f",
      "border_inactive": "#d8cfbd",
      "border_active": "#b0532a",
      "urgent": "#c13b3b",
      "ok": "#1f8a5c",
      "warn": "#a1660f"
    },
    "gtk": {
      "color_scheme": "default",
      "theme": "Adwaita"
    },
    "terminal": {
      "background": "#f5f2ea",
      "foreground": "#24211b",
      "cursor": "#94431f",
      "palette": [
        "#393630",
        "#a52727",
        "#27a551",
        "#a58627",
        "#275ba5",
        "#9027a5",
        "#279ba5",
        "#c1beb6",
        "#6d6a63",
        "#d02525",
        "#25d05e",
        "#d0a525",
        "#256cd0",
        "#b425d0",
        "#25c2d0",
        "#e8e5de"
      ]
    }
  },
  {
    "name": "herald-rose",
    "label": "Herald Rose",
    "description": "Dark plum with a rose-pink accent.",
    "shell": {
      "scheme": "dark"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#170b10",
      "bg2": "#27121b",
      "surface": "#2e1621",
      "fg": "#fbeef2",
      "fg_dim": "#c59cab",
      "accent": "#ff6f9c",
      "accent_strong": "#ff8fb3",
      "border_inactive": "#3f1e2c",
      "border_active": "#ff6f9c",
      "urgent": "#ff6b6b",
      "ok": "#5fd39a",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#170b10",
      "foreground": "#fbeef2",
      "cursor": "#ff8fb3",
      "palette": [
        "#403439",
        "#dc6a6a",
        "#6adc90",
        "#dcc06a",
        "#6a9adc",
        "#c96adc",
        "#6ad3dc",
        "#e4d7db",
        "#6e6166",
        "#ed9797",
        "#97edb4",
        "#edd797",
        "#97bbed",
        "#de97ed",
        "#97e6ed",
        "#ffffff"
      ]
    }
  },
  {
    "name": "herald-violet",
    "label": "Herald Violet",
    "description": "Ocean with a violet accent.",
    "shell": {
      "theme": "ocean",
      "accent": "violet"
    },
    "wallpaper": "default",
    "colors": {
      "bg": "#04113f",
      "bg2": "#0a2a96",
      "surface": "#0b1c5a",
      "fg": "#e9eefb",
      "fg_dim": "#9fb0dc",
      "accent": "#7c6cff",
      "accent_strong": "#978aff",
      "border_active": "#7c6cff",
      "border_inactive": "#1c2c66",
      "urgent": "#ff6b6b",
      "ok": "#36e6a6",
      "warn": "#f2c25e"
    },
    "gtk": {
      "color_scheme": "prefer-dark",
      "theme": "Adwaita-dark"
    },
    "terminal": {
      "background": "#050f33",
      "foreground": "#e9eefb",
      "cursor": "#978aff",
      "palette": [
        "#0b1c5a",
        "#ff6d6d",
        "#36e6a6",
        "#f2c25e",
        "#7c6cff",
        "#b47cff",
        "#4cc2ff",
        "#e9eefb",
        "#2a3a7a",
        "#ff8a8a",
        "#6fffc4",
        "#ffd67a",
        "#978aff",
        "#c9a0ff",
        "#8ad9ff",
        "#ffffff"
      ]
    }
  }
];
