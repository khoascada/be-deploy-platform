# DI & Module Decorators

Nhóm này xử lý **Dependency Injection và cấu trúc module** của NestJS.

---

## `@Injectable`

Đánh dấu class có thể được inject vào class khác qua constructor. Bắt buộc cho Service, Repository, Guard, Interceptor, Filter, Strategy.

```ts
@Injectable()
export class UserService {
  constructor(private readonly users: UsersRepository) {}
  //           ↑ NestJS tự inject instance của UsersRepository
}
```

> Không có `@Injectable()` → NestJS không quản lý lifecycle của class → inject sẽ fail.

---

## `@Module`

Định nghĩa một module: khai báo providers, imports, exports.

```ts
@Module({
  imports: [PrismaModule],      // module khác cần dùng
  controllers: [UserController],
  providers: [UserService, UsersRepository],
  exports: [UserService],       // cho module khác import dùng
})
export class UserModule {}
```

| Field | Ý nghĩa |
|---|---|
| `imports` | Các module cần thiết (lấy exports của chúng) |
| `controllers` | Route handlers của module này |
| `providers` | Services, repositories, guards... |
| `exports` | Những provider cho phép module khác dùng |

---

## `@Global`

Biến module thành global — các module khác không cần `imports` vẫn dùng được exports của nó.

```ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Dùng cho những service dùng ở khắp nơi như `PrismaService`, `RedisService`. Không nên lạm dụng vì làm mờ dependency graph.

---

## `@Inject`

Inject thủ công khi NestJS không tự infer được (thường là inject token/string thay vì class).

```ts
@Injectable()
export class AuthService {
  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}
}
```

Với class provider thông thường thì không cần `@Inject` — TypeScript type đủ để NestJS tự resolve.
