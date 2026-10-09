<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\Client;

/**
 * Drives the user API the way the front-end does: register, then log in.
 */
trait UserApiTrait
{
    private const string PASSWORD = 'correct-horse-battery';

    /**
     * @return array<string, mixed> the created user as returned by the API
     */
    private function register(Client $client, string $email, string $password = self::PASSWORD): array
    {
        $response = $client->request('POST', '/api/users', [
            'json' => ['email' => $email, 'password' => $password],
        ]);
        self::assertResponseStatusCodeSame(201);

        return $response->toArray();
    }

    private function login(Client $client, string $email, string $password = self::PASSWORD): string
    {
        return $this->loginWithRefreshToken($client, $email, $password)['token'];
    }

    /**
     * @return array{token: string, refresh_token: string}
     */
    private function loginWithRefreshToken(Client $client, string $email, string $password = self::PASSWORD): array
    {
        $response = $client->request('POST', '/api/login_check', [
            'json' => ['email' => $email, 'password' => $password],
        ]);
        self::assertResponseIsSuccessful();

        return $response->toArray();
    }
}
