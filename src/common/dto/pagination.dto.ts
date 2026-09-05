import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** Pagination imposée par le CDC : 25 par défaut, 200 maximum. */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number = 25;
}

export interface ReponsePaginee<T> {
  donnees: T[];
  page: number;
  limite: number;
  total: number;
  pages: number;
}

export function paginer<T>(donnees: T[], total: number, page: number, limite: number): ReponsePaginee<T> {
  return {
    donnees,
    page,
    limite,
    total,
    pages: Math.ceil(total / limite) || 1,
  };
}
