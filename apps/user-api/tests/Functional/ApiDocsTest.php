<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use ApiPlatform\Test\ApiTestCase;

final class ApiDocsTest extends ApiTestCase
{
    public function testApiEntrypointIsPubliclyAvailable(): void
    {
        static::createClient()->request('GET', '/api', [
            'headers' => ['Accept' => 'application/ld+json'],
        ]);

        self::assertResponseIsSuccessful();
        self::assertResponseHeaderSame('content-type', 'application/ld+json');
        self::assertJsonContains(['@id' => '/api']);
    }
}
