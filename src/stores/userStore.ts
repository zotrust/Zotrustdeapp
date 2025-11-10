import { create } from 'zustand';
import { User, Agent, Location, ProfileData } from '../types';

interface UserStore {
  user: User | null;
  agents: Agent[];
  locations: Location[];
  isLoading: boolean;
  setUser: (user: User | null) => void;
  updateProfile: (data: ProfileData) => Promise<boolean>;
  fetchAgents: (locationId?: string) => Promise<void>;
  fetchLocations: () => Promise<void>;
  fetchUserProfile: (address: string) => Promise<void>;
  loginWithWallet: (address: string, signature: string, message: string) => Promise<boolean>;
  refreshUserProfile: () => Promise<void>;
}

// Helper function to get auth token
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Helper function to set auth token
const setAuthToken = (token: string) => {
  localStorage.setItem('authToken', token);
};


export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  agents: [],
  locations: [],
  isLoading: false,

  setUser: (user: User | null) => {
    set({ user });
  },

  updateProfile: async (data: ProfileData) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No auth token found - user needs to login first');
        // Show a more user-friendly message
        alert('Please connect your wallet and login first before updating your profile.');
        return false;
      }

      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: data.name,
          phone: data.phone,
          location_id: data.locationId,
          selected_agent_ids: data.selectedAgentIds
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Update local user state
          const currentUser = get().user;
          if (currentUser) {
            set({
              user: {
                ...currentUser,
                name: data.name,
                phone: data.phone,
                locationId: data.locationId,
                selectedAgentIds: data.selectedAgentIds
              }
            });
          }
          return true;
        }
      } else {
        const errorData = await response.json();
        console.error('Profile update failed:', errorData.error);
        alert(`Failed to update profile: ${errorData.error || 'Unknown error'}`);
      }
      return false;
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Failed to update profile. Please try again.');
      return false;
    }
  },

  fetchAgents: async (locationId?: string) => {
    try {
      // Use the public agents API endpoint
      const url = locationId ? `/api/agents?location_id=${encodeURIComponent(locationId)}` : '/api/agents';
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Transform the data to match our Agent interface
          const transformedAgents = data.data.map((agent: any) => ({
            id: agent.id,
            branchName: agent.branch_name,
            mobile: agent.mobile,
            address: agent.address || '',
            locationId: agent.location_id,
            locationName: agent.location_name || 'Unknown Location',
            verified: agent.verified,
            createdByAdmin: agent.created_by_admin,
            createdAt: agent.created_at
          }));
          set({ agents: transformedAgents });
        } else {
          console.error('Failed to fetch agents:', data.error);
          set({ agents: [] });
        }
      } else {
        console.error('Failed to fetch agents');
        set({ agents: [] });
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      set({ agents: [] });
    }
  },

  fetchLocations: async () => {
    try {
      const response = await fetch('/api/locations');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          set({ locations: data.data });
        } else {
          console.error('Failed to fetch locations:', data.error);
          set({ locations: [] });
        }
      } else {
        console.error('Failed to fetch locations');
        set({ locations: [] });
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      set({ locations: [] });
    }
  },

  fetchUserProfile: async (address: string) => {
    set({ isLoading: true });
    try {
      const token = getAuthToken();
      
      // Try to fetch user by address even without token
      const response = await fetch(`/api/auth/user-by-address?address=${encodeURIComponent(address)}`, {
        method: 'GET',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const apiUser = data.data;
          const mappedUser: User = {
            id: String(apiUser.id ?? ''),
            address: apiUser.address,
            name: apiUser.name ?? undefined,
            phone: apiUser.phone ?? undefined,
            locationId: apiUser.location_id ?? undefined,
            selectedAgentIds: apiUser.selected_agent_ids ? apiUser.selected_agent_ids.map(String) : [],
            verified: Boolean(apiUser.verified),
            verifiedAt: apiUser.verified_at ?? undefined,
            createdAt: apiUser.created_at ?? new Date().toISOString()
          };
          set({ user: mappedUser });
          return;
        }
      }
      
      // If no token or fetch failed, create a minimal user
      if (!token) {
        const defaultUser: User = {
          id: Date.now().toString(),
          address: address,
          verified: false,
          createdAt: new Date().toISOString()
        };
        set({ user: defaultUser });
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithWallet: async (address: string, signature: string, message: string) => {
    try {
      const response = await fetch('/api/auth/wallet-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address,
          signature,
          message
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.token) {
          setAuthToken(data.data.token);
          
          // Fetch user profile after successful login
          await get().fetchUserProfile(address);
          
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },

  refreshUserProfile: async () => {
    const currentUser = get().user;
    if (currentUser?.address) {
      console.log('🔄 Refreshing user profile after verification...');
      await get().fetchUserProfile(currentUser.address);
    }
  }
}));