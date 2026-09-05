import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ConnexionDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  @MaxLength(120)
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  @MaxLength(200)
  motDePasse: string;
}

export class ChangerMotDePasseDto {
  @IsString()
  @IsNotEmpty()
  ancienMotDePasse: string;

  @IsString()
  @MinLength(10, { message: 'Le nouveau mot de passe doit contenir au moins 10 caractères.' })
  @MaxLength(200)
  nouveauMotDePasse: string;
}

export class ProfilDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nom: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  prenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telephone?: string;
}

export class RafraichirDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
