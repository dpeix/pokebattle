<?php

declare(strict_types=1);

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;
use Gesdinet\JWTRefreshTokenBundle\Entity\RefreshToken as BaseRefreshToken;
use Gesdinet\JWTRefreshTokenBundle\Entity\RefreshTokenRepository;

#[ORM\Entity(repositoryClass: RefreshTokenRepository::class)]
#[ORM\Table(name: 'refresh_tokens')]
// Every rotation and reuse check looks tokens up by family.
#[ORM\Index(fields: ['family'])]
class RefreshToken extends BaseRefreshToken
{
}
