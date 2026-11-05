import type {
  DashboardSummary,
  OpsBuildingMetric,
  OpsBuildingView,
  OpsMetricStatus,
  OpsRoomView,
  OpsWeeklyCell,
  RoomDto,
} from '@smart-campus/shared-types';

export type OpsMetric = 'occupancy' | 'temperature' | 'co2' | 'humidity';

export type MetricStatus = OpsMetricStatus;
export type BuildingMetric = OpsBuildingMetric;
export type CampusBuildingView = OpsBuildingView;
export type WeeklyCell = OpsWeeklyCell;

export type CampusOpsData = {
  summary: DashboardSummary | null;
  buildings: CampusBuildingView[];
  rooms: RoomDto[];
  opsRooms: OpsRoomView[];
  weeklyPattern: WeeklyCell[];
  occupancyPeople: number;
  occupancyPercent: number;
  occupancyIsDemo: boolean;
  loading: boolean;
  error: string | null;
};
