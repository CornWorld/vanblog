export class Draft {
  id!: number;
  title!: string;
  content!: string;
  pathname?: string;
  tags!: string[];
  category?: string;
  author!: string;
  version!: number;
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
  category?: string;
  author!: string;
  createdAt!: Date;

  constructor(partial: Partial<DraftVersion>) {
    Object.assign(this, partial);
  }
}
