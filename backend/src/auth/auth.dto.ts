import { IsString, IsEmail, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;
}

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;
}
