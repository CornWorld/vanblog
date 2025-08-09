export class Tag {
  id!: number;
  name!: string;
  slug?: string | null;
  createdAt!: string;
  updatedAt?: string;

  constructor(partial: Partial<Tag>) {
    Object.assign(this, partial);
  }
}
