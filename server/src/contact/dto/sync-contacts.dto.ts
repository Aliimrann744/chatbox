import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DeviceContact {
  @IsString()
  phone: string;

  @IsString()
  name: string;
}

export class SyncContactsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  phoneNumbers?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeviceContact)
  contacts?: DeviceContact[];
}
