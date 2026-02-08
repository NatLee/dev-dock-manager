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
  /** True if container has Traefik labels for NoVNC (created after routing update). */
  novnc_ready?: boolean;
}

export interface Image {
  id: string;
  name: string | null;
  short_id: string;
  size: number;
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
