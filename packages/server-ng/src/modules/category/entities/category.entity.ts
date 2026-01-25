export class Category {
  id!: number;
  name!: string;
  slug!: string | null;
  description!: string | null;
  private!: boolean | null;
  password!: string | null;
  createdAt!: string;
  updatedAt!: string;

  constructor(partial: Partial<Category>) {
    Object.assign(this, partial);
  }
}
