import { apiClient, unwrap } from '@/lib/api';

export interface WorkspaceLocation {
  id: string;
  name: string;
  code: string;
  type?: string;
  isActive: boolean;
}

export const workspaceAPI = {
  async locations() {
    return unwrap<WorkspaceLocation[]>(await apiClient.get('/business/location-options'));
  },
};
