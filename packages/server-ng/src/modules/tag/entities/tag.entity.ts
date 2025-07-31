export class Tag {
  id!: number;
  name!: string;
  slug?: string | null;
  createdAt!: Date;
  updatedAt?: Date;

  constructor(partial: Partial<Tag>) {
    Object.assign(this, partial);
  }
}
