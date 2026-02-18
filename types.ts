
export interface HistoryEntry {
  date: string;
  package: string;
  added: string;
}

export interface Account {
  account: string;
  expire: string;
  status: 'active' | 'inactive';
  package: string;
  history: HistoryEntry[];
}

export interface AdminStats {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastPackageAmount: number;
  activeAccounts: number;
  expiringSoon: number;
}

export enum ViewMode {
  PUBLIC = 'PUBLIC',
  LOGIN = 'LOGIN',
  ADMIN = 'ADMIN'
}

export interface UserSession {
  isAdmin: boolean;
  username?: string;
}
