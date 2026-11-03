export interface Container {
  id: string;
  name: string;
  status: string;
  command: string[] | null;
  short_id: string;
  image_tag: string;
  ports: { ssh?: number };
  privileged: boolean;
  nvdocker: boolean;
  size_raw: number;
  size_fs: number;
  /** Owner's user id; null for containers created before ownership existed (admins only see those). */
  owner_id?: number | null;
  /** Owner's username, so admins can tell whose container it is. */
  owner?: string | null;
}

export interface Image {
  id: string;
  name: string | null;
  short_id: string;
  size: number;
  /** All tags for this image that match DOCKER_IMAGE_NAME (e.g. multiple versions) */
  tags?: string[];
}

export interface ConsoleInfo {
  id: string;
  container_name: string;
  image: string;
  short_id: string;
  command: string | null;
  action: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
}

export interface RunContainerBody {
  container_name: string;
  ssh: string;
  user: string;
  password: string;
  vnc_password: string;
  root_password: string;
  privileged?: boolean;
  nvdocker?: boolean;
}

/** A login account, as returned by /dashboard/api/me and /dashboard/api/users. */
export interface Account {
  id: number;
  username: string;
  email: string | null;
  is_admin: boolean;
  is_active: boolean;
  /** When the account was created (format depends on the backend). */
  created_at?: string | null;
}
