export interface TimeEntry {
  date: string;
  repository: string;
  branch: string;
  duration: number; // in seconds
  startTime: number;
  endTime: number;
}

export interface ActiveSession {
  repository: string;
  branch: string;
  startTime: number;
  lastActivity: number;
}
