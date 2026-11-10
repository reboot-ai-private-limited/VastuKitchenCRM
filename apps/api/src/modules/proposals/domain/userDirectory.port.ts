export interface DirectoryUser {
  id: string;
  name: string;
}

export interface UserDirectoryPort {
  find(ids: string[]): Promise<DirectoryUser[]>;
}
