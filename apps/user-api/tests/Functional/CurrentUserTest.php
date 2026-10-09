<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\ApiTestCase;

final class CurrentUserTest extends ApiTestCase
{
    use UserApiTrait;

    public function testRequiresAToken(): void
    {
        static::createClient()->request('GET', '/api/me');

        self::assertResponseStatusCodeSame(401);
    }

    public function testRejectsAnInvalidToken(): void
    {
        static::createClient()->request('GET', '/api/me', ['auth_bearer' => 'not.a.jwt']);

        self::assertResponseStatusCodeSame(401);
    }

    public function testReturnsTheAuthenticatedUser(): void
    {
        $client = static::createClient();
        $registered = $this->register($client, 'ash@example.com');
        $token = $this->login($client, 'ash@example.com');

        $client->request('GET', '/api/me', ['auth_bearer' => $token]);

        self::assertResponseIsSuccessful();
        self::assertJsonContains(['id' => $registered['id'], 'email' => 'ash@example.com']);
    }

    public function testAUserCanReadTheirOwnResource(): void
    {
        $client = static::createClient();
        $registered = $this->register($client, 'ash@example.com');
        $token = $this->login($client, 'ash@example.com');

        $client->request('GET', $registered['@id'], ['auth_bearer' => $token]);

        self::assertResponseIsSuccessful();
    }

    public function testAUserCannotReadAnotherUser(): void
    {
        $client = static::createClient();
        $other = $this->register($client, 'misty@example.com');
        $this->register($client, 'ash@example.com');
        $token = $this->login($client, 'ash@example.com');

        $client->request('GET', $other['@id'], ['auth_bearer' => $token]);

        self::assertResponseStatusCodeSame(403);
    }

    public function testUsersCannotBeListed(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');
        $token = $this->login($client, 'ash@example.com');

        $client->request('GET', '/api/users', ['auth_bearer' => $token]);

        self::assertResponseStatusCodeSame(405);
    }
}
