export interface Snippet {
  id?: number;
  keyword: string;
  name: string;
  text: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RaycastSnippet {
  keyword: string;
  name: string;
  text: string;
}
