"use client"

// recharts 진입점을 하나로 모은다.
// 화면마다 직접 import 하면 쓰는 부품에 따라 번들이 화면 수만큼 갈라져, 메뉴를 처음 열 때마다 같은 라이브러리를 다시 받는다.
// 네임스페이스로 한 번 받아 내보내면 모든 화면이 같은 청크를 공유한다.
import * as Recharts from "recharts"

export const {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} = Recharts
