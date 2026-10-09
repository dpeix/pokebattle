<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\ApiTestCase;
use App\Repository\UserRepository;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class RegistrationTest extends ApiTestCase
{
    use UserApiTrait;

    public function testRegistersAUserWithoutExposingThePassword(): void
    {
        $user = $this->register(static::createClient(), 'ash@example.com');

        self::assertSame('ash@example.com', $user['email']);
        self::assertArrayHasKey('id', $user);
        self::assertArrayNotHasKey('password', $user);
        self::assertArrayNotHasKey('plainPassword', $user);
    }

    public function testStoresAHashedPassword(): void
    {
        $this->register(static::createClient(), 'ash@example.com');

        $stored = static::getContainer()->get(UserRepository::class)->findOneBy(['email' => 'ash@example.com']);
        self::assertNotNull($stored);
        self::assertNotSame(self::PASSWORD, $stored->getPassword());
        self::assertTrue(static::getContainer()->get(UserPasswordHasherInterface::class)->isPasswordValid($stored, self::PASSWORD));
    }

    public function testNormalizesTheEmail(): void
    {
        $user = $this->register(static::createClient(), '  Ash@Example.COM ');

        self::assertSame('ash@example.com', $user['email']);
    }

    public function testRejectsAnEmailAlreadyInUse(): void
    {
        $client = static::createClient();
        $this->register($client, 'ash@example.com');

        $client->request('POST', '/api/users', [
            'json' => ['email' => 'ASH@example.com', 'password' => self::PASSWORD],
        ]);

        self::assertResponseStatusCodeSame(422);
        self::assertJsonContains(['violations' => [['propertyPath' => 'email']]]);
    }

    /**
     * @return iterable<string, array{array<string, mixed>, string}>
     */
    public static function invalidPayloads(): iterable
    {
        yield 'invalid email' => [['email' => 'not-an-email', 'password' => self::PASSWORD], 'email'];
        yield 'missing email' => [['password' => self::PASSWORD], 'email'];
        yield 'short password' => [['email' => 'ash@example.com', 'password' => 'short'], 'password'];
        yield 'missing password' => [['email' => 'ash@example.com'], 'password'];
    }

    /**
     * @param array<string, mixed> $payload
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('invalidPayloads')]
    public function testRejectsInvalidPayloads(array $payload, string $invalidProperty): void
    {
        static::createClient()->request('POST', '/api/users', ['json' => $payload]);

        self::assertResponseStatusCodeSame(422);
        self::assertJsonContains(['violations' => [['propertyPath' => $invalidProperty]]]);
    }

    public function testIgnoresRolesSentByTheClient(): void
    {
        $response = static::createClient()->request('POST', '/api/users', [
            'json' => ['email' => 'ash@example.com', 'password' => self::PASSWORD, 'roles' => ['ROLE_ADMIN']],
        ]);

        self::assertResponseStatusCodeSame(201);
        self::assertSame(['ROLE_USER'], $response->toArray()['roles']);
    }
}
