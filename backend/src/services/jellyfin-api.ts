import axios, { AxiosInstance } from 'axios';
import { buildJellyfinAuthorization } from './jellyfin-auth';

export function createJellyfinClient(baseUrl: string, apiKey: string, timeout?: number): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ''),
    headers: {
      Authorization: buildJellyfinAuthorization(apiKey),
      Accept: 'application/json',
    },
    timeout,
  });
}
