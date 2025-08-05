export class Category {
  id!: number;
  name!: string;
  slug!: string | null;
  description!: string | null;
  private!: boolean | null;
  password!: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  constructor(partial: Partial<Category>) {
    Object.assign(this, partial);
  }
}
