<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\ApiTestCase;

final class LoginTest extends ApiTestCase
{
    use UserApiTrait;

    public function testReturnsAJwtForValidCredentials(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');

        $token = $this->login($client, 'ash@example.com');

        self::assertCount(3, explode('.', $token), 'a JWT has three dot-separated parts');
    }

    public function testRejectsAWrongPassword(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');

        $client->request('POST', '/api/login_check', [
            'json' => ['email' => 'ash@example.com', 'password' => 'wrong-password'],
        ]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testRejectsAnUnknownEmail(): void
    {
        static::createClient()->request('POST', '/api/login_check', [
            'json' => ['email' => 'nobody@example.com', 'password' => self::PASSWORD],
        ]);

        self::assertResponseStatusCodeSame(401);
    }

    public function testBlocksLoginAfterTooManyFailedAttempts(): void
    {
        $client = static::createClient();
        // Throttling state is kept in the cache (not rolled back like the database):
        // a unique email keeps it from blocking other tests or later runs.
        $email = sprintf('throttled-%s@example.com', bin2hex(random_bytes(6)));
        $this->register($client, $email);

        for ($attempt = 1; $attempt <= 5; ++$attempt) {
            $client->request('POST', '/api/login_check', [
                'json' => ['email' => $email, 'password' => 'wrong-password'],
            ]);
        }
        $client->request('POST', '/api/login_check', [
            'json' => ['email' => $email, 'password' => self::PASSWORD],
        ]);

        self::assertResponseStatusCodeSame(401);
    }
}
