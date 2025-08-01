export class Draft {
  id!: number;
  title!: string;
  content!: string;
  pathname?: string;
  tags!: string[];
  categories!: string[];
  category?: string;
  author!: string;
  version!: number;
  userId!: number;
  wordCount!: number;
  readTime!: number;
  summary?: string;
  cover?: string;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<Draft>) {
    Object.assign(this, partial);
  }
}

export class DraftVersion {
  id!: number;
  draftId!: number;
  version!: number;
  title!: string;
  content!: string;
  pathname?: string;
  tags!: string[];
  categories!: string[];
  category?: string;
  author!: string;
  summary?: string;
  cover?: string;
  createdAt!: Date;
  comment?: string;

  constructor(partial: Partial<DraftVersion>) {
    Object.assign(this, partial);
  }
}
