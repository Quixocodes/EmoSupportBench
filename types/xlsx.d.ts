declare module 'xlsx' {
  export interface WorkBook {
    SheetNames: string[];
    Sheets: { [sheet: string]: WorkSheet };
  }

  export interface WorkSheet {
    [cell: string]: any;
    '!ref'?: string;
    '!cols'?: Array<{ wch: number }>;
  }

  export const utils: {
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, worksheet: WorkSheet, name: string): void;
    aoa_to_sheet(data: any[][]): WorkSheet;
  };

  export function write(workbook: WorkBook, options: { type: 'buffer' | 'binary'; bookType: 'xlsx' }): Buffer;
}
