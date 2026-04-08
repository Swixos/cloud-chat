import { IsString, IsEmail, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/(?=.*[a-z])/, { message: 'Le mot de passe doit contenir au moins une minuscule' })
  @Matches(/(?=.*[A-Z])/, { message: 'Le mot de passe doit contenir au moins une majuscule' })
  @Matches(/(?=.*[!@#$%^&*(),.?":{}|<>])/, { message: 'Le mot de passe doit contenir au moins un caractère spécial' })
  password: string;

  @IsEmail()
  email: string;

  @IsString()
  name: string;
}
