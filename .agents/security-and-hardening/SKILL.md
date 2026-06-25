---
name: security-and-hardening
description: Gia cố code chống lỗ hổng. Dùng khi xử lý input người dùng, authentication, lưu trữ dữ liệu, hoặc integration với hệ thống bên ngoài. Dùng khi build bất kỳ feature nào nhận dữ liệu không đáng tin, quản lý session, hoặc tương tác với third-party service.
---

# Bảo Mật Và Gia Cố

## Tổng Quan

Đây là tập thực hành security-first cho ứng dụng web. Hãy coi mọi input ngoài hệ thống là thù địch, mọi secret là thứ phải bảo vệ, và mọi authorization check là bắt buộc. Security không phải một phase, mà là ràng buộc phủ lên từng dòng code có chạm tới dữ liệu người dùng, auth, hoặc external system.

## Khi Nào Dùng

- Build bất cứ thứ gì nhận input người dùng
- Implement authentication hoặc authorization
- Lưu trữ hoặc truyền dữ liệu nhạy cảm
- Tích hợp external API hoặc service
- Thêm file upload, webhook hoặc callback
- Xử lý thanh toán hoặc PII

## Quy Trình: Threat Model Trước

Những control gắn vào sau mà không có threat model chỉ là đoán mò. Trước khi harden, hãy dành vài phút nghĩ như attacker:

1. **Vẽ trust boundary.** Dữ liệu không đáng tin đi vào hệ thống ở đâu? HTTP request, form fields, file uploads, webhooks, third-party APIs, message queues, và cả **LLM output**.
2. **Gọi tên asset.** Cái gì đáng bị đánh cắp hoặc phá? Credentials, PII, payment data, admin actions, luồng tiền.
3. **Chạy STRIDE qua từng boundary** như một lăng kính nhanh:

| Threat | Câu hỏi | Giảm thiểu điển hình |
|---|---|---|
| **S**poofing | Có ai giả mạo được user/service không? | Authentication, signature verification |
| **T**ampering | Dữ liệu có bị sửa trên đường đi hoặc lúc lưu không? | Integrity checks, query có parameterization, HTTPS |
| **R**epudiation | Có ai có thể chối việc đã làm không? | Audit log cho security events |
| **I**nformation disclosure | Có dữ liệu nào bị lộ không? | Encryption, allowlist field, generic errors |
| **D**enial of service | Có thể bị bắn ngập hoặc treo không? | Rate limiting, input size caps, timeouts |
| **E**levation of privilege | User có leo quyền được không? | Authorization checks, least privilege |

4. **Viết abuse case ngay cạnh use case.** Với mỗi feature, hỏi "nếu muốn lạm dụng nó thì tôi sẽ làm gì?" rồi biến câu trả lời đó thành test đầu tiên.

Nếu bạn không gọi tên được trust boundary của feature, bạn chưa sẵn sàng để secure nó.

## Hệ Boundary Ba Tầng

### Luôn Làm - Không Ngoại Lệ

- **Validate mọi input bên ngoài** tại boundary
- **Parameterize toàn bộ database query**
- **Encode output** để ngăn XSS
- **Dùng HTTPS** cho mọi giao tiếp ra ngoài
- **Hash password** bằng bcrypt/scrypt/argon2
- **Set security headers** như CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Dùng cookie có `httpOnly`, `secure`, `sameSite`** cho session
- **Chạy `npm audit`** trước mỗi release

### Phải Hỏi Trước

- Thêm auth flow mới hoặc đổi logic auth
- Lưu loại dữ liệu nhạy cảm mới
- Tích hợp external service mới
- Thay đổi CORS configuration
- Thêm file upload handler
- Thay đổi rate limit hoặc throttling
- Cấp quyền cao hơn hoặc role mới

### Tuyệt Đối Không

- **Không commit secrets**
- **Không log dữ liệu nhạy cảm**
- **Không tin client-side validation như một security boundary**
- **Không tắt security headers cho tiện**
- **Không dùng `eval()` hoặc `innerHTML`** với dữ liệu người dùng
- **Không để session trong nơi client truy cập được** như localStorage
- **Không lộ stack trace hoặc internal error ra cho user**

## Các Mẫu Phòng Ngừa Theo OWASP Top 10

### Injection

```typescript
const user = await prisma.user.findUnique({ where: { id: userId } });
```

Tránh nối chuỗi SQL bằng input người dùng.

### Broken Authentication

```typescript
import { hash, compare } from 'bcrypt';

const SALT_ROUNDS = 12;
const hashedPassword = await hash(plaintext, SALT_ROUNDS);
const isValid = await compare(plaintext, hashedPassword);
```

Session cookie phải có `httpOnly`, `secure`, `sameSite`, và secret phải lấy từ environment.

### Cross-Site Scripting

```typescript
return <div>{userInput}</div>;
```

Ưu tiên auto-escaping của framework. Nếu buộc phải render HTML, sanitize trước.

### Broken Access Control

```typescript
app.patch('/api/tasks/:id', authenticate, async (req, res) => {
  const task = await taskService.findById(req.params.id);

  if (task.ownerId !== req.user.id) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Not authorized to modify this task' }
    });
  }

  const updated = await taskService.update(req.params.id, req.body);
  return res.json(updated);
});
```

Không chỉ check authentication; luôn check authorization.

### Security Misconfiguration

```typescript
import helmet from 'helmet';
app.use(helmet());
```

CORS phải hạn chế theo origin đã biết.

### Sensitive Data Exposure

```typescript
function sanitizeUser(user: UserRecord): PublicUser {
  const { passwordHash, resetToken, ...publicFields } = user;
  return publicFields;
}
```

Secrets phải đi qua environment variables.

### SSRF

Bất cứ lúc nào server fetch một URL bị ảnh hưởng bởi user, attacker có thể trỏ nó vào mạng nội bộ, metadata endpoint hoặc localhost.

```typescript
const ALLOWED_HOSTS = new Set(['hooks.example.com']);
```

Hãy allowlist host, ép `https:`, resolve IP và chặn private/reserved range, cấm redirect nếu bề mặt có rủi ro.

## Pattern Validate Input

### Schema Validation Tại Boundary

```typescript
import { z } from 'zod';

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  dueDate: z.string().datetime().optional(),
});
```

Parse ở route handler, và chỉ sau khi parse thành công mới tin dữ liệu đó.

### An Toàn Cho File Upload

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;
```

Luôn giới hạn mime type và kích thước. Nếu bề mặt rủi ro cao, phải kiểm tra magic bytes thay vì chỉ tin extension.

## Cách Triaging Kết Quả npm audit

Không phải mọi cảnh báo đều là blocker ngay lập tức:

```
npm audit báo lỗ hổng
|-- critical/high
|   |-- code path có reachable trong production?
|   |   |-- có -> fix ngay
|   |   '-- không -> fix sớm, nhưng có thể chưa block
|   '-- có bản vá chưa?
|       |-- có -> update
|       '-- chưa -> tìm workaround hoặc thay dependency
|-- moderate
|   |-- reachable trong production -> fix trong release kế tiếp
|   '-- chỉ dev-only -> track rồi xử lý sau
'-- low
    '-- fix trong đợt cập nhật dependency định kỳ
```

Khi defer một lỗ hổng, phải ghi rõ lý do và ngày review lại.

### Supply Chain Hygiene

`npm audit` chỉ bắt CVE đã biết, không bắt package độc hại hay typo-squatting. Ngoài ra:

- commit lockfile và dùng `npm ci` trong CI
- review dependency mới trước khi thêm
- cẩn thận với `postinstall` scripts
- để ý package tên na ná nhau

## Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));
```

Auth endpoint phải rate limit chặt hơn phần còn lại.

## Quản Lý Secrets

```
.env.example -> được commit, chỉ chứa placeholder
.env         -> không commit
.env.local   -> không commit
```

`.gitignore` phải chặn `.env`, `.env.local`, `.env.*.local`, `*.pem`, `*.key`.

Trước khi commit, nên check diff staged để tránh lộ password, secret, api key, token.

Nếu secret từng bị commit, phải **rotate nó**. Xóa khỏi git history thôi là chưa đủ.

## Bảo Mật Cho Tính Năng AI / LLM

Nếu ứng dụng gọi LLM, nó có thêm bề mặt tấn công mới:

- **LLM output là input không đáng tin.** Không đẩy thẳng vào `eval`, SQL, shell, `innerHTML`, hay file path.
- **Prompt có thể bị hijack.** Text không đáng tin trong context window có thể chứa instruction.
- **Đừng đưa secret hay dữ liệu chéo tenant vào prompt.**
- **Giới hạn quyền của tool/agent.** Với hành động phá hủy hoặc không thể đảo ngược, cần confirmation.
- **Giới hạn token, rate, loop depth.**
- **Trong RAG, vector store cũng là trust boundary.**

```typescript
let intent;
try {
  intent = CommandSchema.parse(JSON.parse(await llm.replyJson(userMessage)));
} catch {
  throw new ValidationError('unexpected model output');
}
await runAllowlistedAction(intent.action, intent.params);
```

## Checklist Review Security

```markdown
### Authentication
- [ ] Password được hash bằng bcrypt/scrypt/argon2
- [ ] Session token là httpOnly, secure, sameSite
- [ ] Login có rate limiting
- [ ] Password reset token có hết hạn

### Authorization
- [ ] Mọi endpoint đều check quyền
- [ ] User chỉ truy cập resource của mình
- [ ] Hành động admin cần verify role admin

### Input
- [ ] Mọi input người dùng được validate ở boundary
- [ ] SQL query có parameterization
- [ ] HTML output được encode/escape
- [ ] URL fetch phía server có allowlist

### Data
- [ ] Không có secret trong code hoặc git
- [ ] Field nhạy cảm bị loại khỏi API response
- [ ] PII được encrypt at rest khi cần

### Infrastructure
- [ ] Security headers đã cấu hình
- [ ] CORS bị giới hạn theo origin đã biết
- [ ] Dependency đã được audit
- [ ] Error message không lộ nội bộ

### Supply Chain
- [ ] Lockfile được commit; CI dùng `npm ci`
- [ ] Dependency mới đã được review

### AI / LLM
- [ ] Model output được xem là untrusted
- [ ] Secret và dữ liệu tenant khác không nằm trong prompt
- [ ] Tool/agent permissions được giới hạn; hành động phá hủy cần xác nhận
```

## Tham Khảo Thêm

Xem `references/security-checklist.md` nếu cần checklist chi tiết hơn.

## Những Lý Do Tự Hợp Lý Hóa Thường Gặp

| Lý do | Sự thật |
|---|---|
| "Đây chỉ là tool nội bộ" | Tool nội bộ vẫn bị tấn công. |
| "Security để sau" | Retro-fit security luôn đắt hơn rất nhiều. |
| "Không ai rảnh đi khai thác đâu" | Scanner tự động thì có. |
| "Framework lo hết rồi" | Framework chỉ đưa tool, không cho bảo đảm. |
| "Chỉ là prototype" | Prototype rất hay thành production. |
| "Threat model là overkill" | 5 phút nghĩ như attacker cứu bạn khỏi design flaw mà không control nào vá nổi. |
| "LLM output chỉ là text thôi mà" | "Text" đó có thể là SQL, script tag, hoặc shell command. |

## Red Flags

- User input đi thẳng vào query, shell command hoặc HTML render
- Secret nằm trong source code hoặc git history
- API endpoint không có auth hoặc authz
- CORS wildcard
- Không rate limit auth endpoint
- Lộ stack trace hoặc internal error cho user
- Dependency có critical vulnerability đã biết
- Server fetch URL người dùng đưa mà không allowlist
- Đưa model output vào query, DOM, shell hoặc `eval`
- Đưa secret, PII hoặc full system prompt vào LLM context

## Verification

Sau khi implement code liên quan tới security, xác nhận:

- [ ] `npm audit` không còn critical hoặc high vulnerability
- [ ] Không có secret trong source code hoặc git history
- [ ] Mọi input người dùng được validate ở boundary
- [ ] Authentication và authorization được check ở mọi endpoint cần bảo vệ
- [ ] Security headers có mặt trong response
- [ ] Error response không lộ chi tiết nội bộ
- [ ] Rate limiting hoạt động ở auth endpoints
- [ ] URL fetch phía server đã được validate bằng allowlist
- [ ] LLM/model output được validate và encode trước khi dùng nếu có AI features
