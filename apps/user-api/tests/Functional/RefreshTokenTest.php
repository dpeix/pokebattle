<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\ApiTestCase;
use App\Entity\RefreshToken;
use Doctrine\ORM\EntityManagerInterface;

final class RefreshTokenTest extends ApiTestCase
{
    use UserApiTrait;

    public function testLoginReturnsARefreshToken(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');

        $tokens = $this->loginWithRefreshToken($client, 'ash@example.com');

        self::assertNotEmpty($tokens['refresh_token']);
    }

    public function testExchangesARefreshTokenForNewTokens(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');
        $tokens = $this->loginWithRefreshToken($client, 'ash@example.com');

        $response = $client->request('POST', '/api/token/refresh', [
            'json' => ['refresh_token' => $tokens['refresh_token']],
        ]);

        self::assertResponseIsSuccessful();
        $renewed = $response->toArray();
        self::assertNotSame($tokens['refresh_token'], $renewed['refresh_token'], 'refresh tokens are rotated');

        $client->request('GET', '/api/me', ['auth_bearer' => $renewed['token']]);
        self::assertResponseIsSuccessful();
        self::assertJsonContains(['email' => 'ash@example.com']);
    }

    public function testARefreshTokenCanOnlyBeUsedOnce(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');
        $tokens = $this->loginWithRefreshToken($client, 'ash@example.com');
        $client->request('POST', '/api/token/refresh', [
            'json' => ['refresh_token' => $tokens['refresh_token']],
        ]);
        self::assertResponseIsSuccessful();

        $client->request('POST', '/api/token/refresh', [
            'json' => ['refresh_token' => $tokens['refresh_token']],
        ]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testStoresRefreshTokensHashed(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');
        $refreshToken = $this->loginWithRefreshToken($client, 'ash@example.com')['refresh_token'];

        $stored = static::getContainer()->get(EntityManagerInterface::class)
            ->getRepository(RefreshToken::class)
            ->findBy(['username' => 'ash@example.com']);

        self::assertCount(1, $stored);
        self::assertNotSame($refreshToken, $stored[0]->getRefreshToken());
    }

    public function testRejectsAnUnknownRefreshToken(): void
    {
        static::createClient()->request('POST', '/api/token/refresh', [
            'json' => ['refresh_token' => 'unknown-refresh-token'],
        ]);

        self::assertResponseStatusCodeSame(401);
    }
}
