/* ============================================================================
   dashboard-kit · dk-chart-theme.js  —  СОБРАН АВТОМАТИЧЕСКИ, НЕ ПРАВИТЬ РУКАМИ
   Пересобрать: python3 tools/build-chart-theme.py

   Две темы графиков, выведенные из токенов дизайн-системы. Цвета серий, шрифт,
   сетка и оси здесь не выбраны заново — они взяты из тех же токенов, которыми
   покрашен весь остальной интерфейс. Поэтому график не может разойтись с
   дашбордом, в котором он лежит.

   Подключать ПОСЛЕ echarts и ДО dk-charts.js.
   ============================================================================ */

(function () {
  if (typeof echarts === 'undefined') {
    console.error('dk-chart-theme: сначала нужно подключить echarts');
    return;
  }

  var THEMES = {
  "dark": {
    "color": [
      "#538BDF",
      "#D34089",
      "#DE6B20",
      "#099BA5",
      "#9064FF",
      "#38A169"
    ],
    "backgroundColor": "transparent",
    "textStyle": {
      "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
      "fontSize": 12,
      "color": "#A9B2C2"
    },
    "title": {
      "textStyle": {
        "color": "#FBFBFB",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 16,
        "fontWeight": 600
      },
      "subtextStyle": {
        "color": "#7B8794",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "legend": {
      "textStyle": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "icon": "roundRect",
      "itemWidth": 10,
      "itemHeight": 10,
      "itemGap": 16
    },
    "tooltip": {
      "backgroundColor": "#25272F",
      "borderWidth": 0,
      "padding": [
        10,
        14
      ],
      "textStyle": {
        "color": "#FBFBFB",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 14
      },
      "axisPointer": {
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        },
        "crossStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      }
    },
    "grid": {
      "left": 8,
      "right": 12,
      "top": 24,
      "bottom": 8,
      "containLabel": true
    },
    "categoryAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": false
      },
      "splitArea": {
        "show": false
      }
    },
    "valueAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.07)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "logAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.07)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "timeAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(251,251,251,0.07)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "line": {
      "lineStyle": {
        "width": 2
      },
      "symbolSize": 8,
      "symbol": "circle",
      "smooth": false
    },
    "bar": {
      "itemStyle": {
        "borderRadius": 0
      },
      "barMinWidth": 10,
      "barMaxWidth": 28
    },
    "pie": {
      "itemStyle": {
        "borderColor": "transparent",
        "borderWidth": 2
      },
      "label": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "labelLine": {
        "lineStyle": {
          "color": "rgba(251,251,251,0.16)"
        }
      }
    },
    "radar": {
      "axisLine": {
        "lineStyle": {
          "color": "rgba(251,251,251,0.07)"
        }
      },
      "splitLine": {
        "lineStyle": {
          "color": "rgba(251,251,251,0.07)"
        }
      },
      "splitArea": {
        "show": false
      },
      "axisName": {
        "color": "#7B8794",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "sankey": {
      "itemStyle": {
        "borderWidth": 0
      },
      "lineStyle": {
        "color": "gradient",
        "opacity": 0.35
      },
      "label": {
        "color": "#A9B2C2",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "visualMap": {
      "textStyle": {
        "color": "#7B8794",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "dataZoom": {
      "textStyle": {
        "color": "#7B8794",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    }
  },
  "light": {
    "color": [
      "#2569EF",
      "#C42D78",
      "#DD6B20",
      "#099AA4",
      "#6038A0",
      "#39A169"
    ],
    "backgroundColor": "transparent",
    "textStyle": {
      "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
      "fontSize": 12,
      "color": "#425B88"
    },
    "title": {
      "textStyle": {
        "color": "#10204D",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 16,
        "fontWeight": 600
      },
      "subtextStyle": {
        "color": "#52658A",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "legend": {
      "textStyle": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "icon": "roundRect",
      "itemWidth": 10,
      "itemHeight": 10,
      "itemGap": 16
    },
    "tooltip": {
      "backgroundColor": "#FFFFFF",
      "borderWidth": 0,
      "padding": [
        10,
        14
      ],
      "textStyle": {
        "color": "#10204D",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 14
      },
      "axisPointer": {
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        },
        "crossStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      }
    },
    "grid": {
      "left": 8,
      "right": 12,
      "top": 24,
      "bottom": 8,
      "containLabel": true
    },
    "categoryAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": false
      },
      "splitArea": {
        "show": false
      }
    },
    "valueAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.08)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "logAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.08)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "timeAxis": {
      "axisLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      },
      "axisTick": {
        "show": false
      },
      "axisLabel": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "splitLine": {
        "show": true,
        "lineStyle": {
          "color": "rgba(16,32,77,0.08)",
          "width": 1,
          "opacity": 0.55
        }
      },
      "splitArea": {
        "show": false
      }
    },
    "line": {
      "lineStyle": {
        "width": 2
      },
      "symbolSize": 8,
      "symbol": "circle",
      "smooth": false
    },
    "bar": {
      "itemStyle": {
        "borderRadius": 0
      },
      "barMinWidth": 10,
      "barMaxWidth": 28
    },
    "pie": {
      "itemStyle": {
        "borderColor": "transparent",
        "borderWidth": 2
      },
      "label": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      },
      "labelLine": {
        "lineStyle": {
          "color": "rgba(16,32,77,0.2)"
        }
      }
    },
    "radar": {
      "axisLine": {
        "lineStyle": {
          "color": "rgba(16,32,77,0.08)"
        }
      },
      "splitLine": {
        "lineStyle": {
          "color": "rgba(16,32,77,0.08)"
        }
      },
      "splitArea": {
        "show": false
      },
      "axisName": {
        "color": "#52658A",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "sankey": {
      "itemStyle": {
        "borderWidth": 0
      },
      "lineStyle": {
        "color": "gradient",
        "opacity": 0.35
      },
      "label": {
        "color": "#425B88",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "visualMap": {
      "textStyle": {
        "color": "#52658A",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    },
    "dataZoom": {
      "textStyle": {
        "color": "#52658A",
        "fontFamily": "\"Golos Text\", system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif",
        "fontSize": 12
      }
    }
  }
};

  echarts.registerTheme('dk-dark', THEMES.dark);
  echarts.registerTheme('dk-light', THEMES.light);

  /* Предел числа секторов круговой диаграммы. Канон: дальше читатель перестаёт
     сравнивать доли и начинает гадать. Лишнее сворачивается в «Прочее». */
  window.DK_PIE_MAX_SLICES = 6;

  /* Палитра серий отдельно — нужна там, где цвет назначается вручную:
     точка в легенде, метка на карте, кружок рядом со значением. */
  window.DK_SERIES = { dark: THEMES.dark.color, light: THEMES.light.color };
})();
