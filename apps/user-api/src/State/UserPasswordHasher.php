<?php

declare(strict_types=1);

namespace App\State;

use ApiPlatform\Metadata\Operation;
use ApiPlatform\State\ProcessorInterface;
use App\Entity\User;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

/**
 * Hashes the clear-text password sent by the client before the user is persisted.
 *
 * @implements ProcessorInterface<User, User>
 */
final readonly class UserPasswordHasher implements ProcessorInterface
{
    /**
     * @param ProcessorInterface<User, User> $persistProcessor
     */
    public function __construct(
        #[Autowire(service: 'api_platform.doctrine.orm.state.persist_processor')]
        private ProcessorInterface $persistProcessor,
        private UserPasswordHasherInterface $passwordHasher,
    ) {
    }

    public function process(mixed $data, Operation $operation, array $uriVariables = [], array $context = []): User
    {
        $plainPassword = $data->getPlainPassword();
        if (null !== $plainPassword) {
            $data->setPassword($this->passwordHasher->hashPassword($data, $plainPassword));
            $data->setPlainPassword(null);
        }

        return $this->persistProcessor->process($data, $operation, $uriVariables, $context);
    }
}
