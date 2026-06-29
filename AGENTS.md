# AGENTS.md

File này là bộ quy tắc vận hành mặc định cho mọi AI agent làm việc trong repository này.

## Đọc Trước Khi Làm

Ở đầu mỗi cuộc hội thoại hoặc task:

1. Đọc `AGENTS.md` này.
2. Đọc `.agents/using-agent-skills/SKILL.md`.
3. Xác định skill nào trong `.agents/` phù hợp với task hiện tại.
4. Làm theo đúng workflow của skill đã chọn, không tự ứng biến bừa.

Nếu task không nhỏ và chưa xác định được skill cụ thể, mặc định dùng chuỗi:

`spec-driven-development` -> `planning-and-task-breakdown` -> `incremental-implementation` -> `test-driven-development`

## Các Skill Cục Bộ Hiện Có

- `using-agent-skills`: meta-skill để chọn đúng workflow
- `interview-me`: làm rõ mục tiêu còn mơ hồ trước khi plan hoặc code
- `spec-driven-development`: viết spec trước khi làm các thay đổi không nhỏ
- `planning-and-task-breakdown`: chia scope đã chốt thành các task có thứ tự và có thể kiểm chứng
- `incremental-implementation`: triển khai theo từng lát nhỏ, luôn ở trạng thái chạy được
- `test-driven-development`: viết test fail trước cho thay đổi hành vi và bug fix
- `source-driven-development`: xác minh pattern framework/library bằng tài liệu chính thức trước khi dùng
- `api-and-interface-design`: thiết kế contract ổn định và semantics lỗi nhất quán
- `security-and-hardening`: áp dụng tư duy threat model và các boundary bảo mật

## Quy Tắc Không Được Phá

### 1. Luôn nêu assumption

Trước mọi công việc không nhỏ, phải nêu rõ các assumption đang dùng. Không được âm thầm tự lấp chỗ thiếu của yêu cầu.

### 2. Quản lý sự mơ hồ một cách tường minh

Nếu yêu cầu, code, docs hoặc hành vi mâu thuẫn nhau:

- dừng lại
- nêu rõ mâu thuẫn là gì
- trình bày tradeoff hoặc hỏi câu làm rõ đúng trọng tâm

Không được đoán mò rồi làm tiếp.

### 3. Ưu tiên lời giải đơn giản

Chọn lời giải đúng nhưng đơn giản và nhàm chán nhất có thể. Tránh abstraction quá sớm, thiết kế cho tương lai chưa tồn tại, hoặc tiện tay refactor lan sang vùng khác.

### 4. Giữ kỷ luật phạm vi

Chỉ chạm vào đúng phần task yêu cầu.

Không được:

- dọn dẹp code không liên quan "tiện thể"
- xóa comment hoặc code chưa hiểu rõ
- thêm tính năng không được yêu cầu
- thay đổi hành vi public một cách tùy tiện

### 5. Cái gì cũng phải verify

Một task không hoàn thành chỉ vì "trông có vẻ đúng". Phải dùng test, build, lint và manual verification có mục tiêu khi phù hợp.

Ngoài ra, không được chạy lại đúng cùng một lệnh verify hai lần liên tiếp nếu code không đổi ở giữa.

## Quy Tắc Workflow

### Yêu cầu mơ hồ -> làm rõ trước

Nếu mục tiêu người dùng còn thiếu chi tiết, dùng cách làm kiểu `interview-me`:

- hình thành một giả thuyết
- gắn mức độ tự tin
- hỏi từng câu một, đúng trọng tâm
- restate lại intent trước khi bắt đầu build

### Task không nhỏ -> viết spec trước

Phải viết spec trước khi code nếu đây là feature mới, thay đổi kiến trúc, hoặc bất kỳ thay đổi nào có thể tốn hơn khoảng 30 phút hay chạm nhiều file.

Spec nên định nghĩa:

- objective
- success criteria
- commands
- project structure
- code style expectations
- testing strategy
- boundaries: always / ask first / never

### Có spec rồi -> plan

Chia công việc thành các task nhỏ, có thứ tự, mỗi task có:

- acceptance criteria
- bước verification
- dependencies
- các file có khả năng bị chạm tới

Ưu tiên chia theo vertical slice thay vì chia ngang theo từng layer.

### Implementation -> chỉ làm theo từng lát nhỏ

Với công việc nhiều file hoặc có rủi ro:

- implement một lát nhỏ
- test nó
- verify nó
- rồi mới sang lát tiếp theo

Không được đổ một cục thay đổi lớn chưa verify vào cùng lúc.

### Đổi behavior hoặc sửa bug -> test trước

Với logic mới, đổi hành vi, hoặc bug fix:

- viết test fail trước
- xác nhận test đó thật sự fail
- implement mức tối thiểu để pass
- chạy test liên quan
- rồi chạy verify rộng hơn trước khi kết thúc

## Quy Tắc Source-Driven

Với code phụ thuộc framework cụ thể, không được dựa vào trí nhớ nếu tính đúng đắn phụ thuộc vào version hiện tại.

Các bước bắt buộc:

1. Xác định version từ file dependency cục bộ như `package.json`.
2. Kiểm tra tài liệu chính thức cho feature liên quan.
3. Làm theo pattern đã được tài liệu hướng dẫn.
4. Nếu docs mâu thuẫn với pattern hiện có trong repo, phải nêu mâu thuẫn đó ra thay vì âm thầm chọn một bên.

Nếu không verify được một pattern, phải ghi rõ là chưa xác minh.

## Quy Tắc API và Interface

Khi thiết kế hoặc thay đổi API, DTO, contract sinh ra từ schema, hoặc boundary giữa các module:

- định nghĩa contract trước
- giữ format lỗi nhất quán
- validate input không đáng tin tại boundary
- ưu tiên thay đổi mang tính additive, tương thích ngược
- dùng naming dễ đoán, nhất quán
- endpoint list nên có pagination mặc định

Hãy nhớ Hyrum's Law: mọi hành vi có thể quan sát được rồi sẽ trở thành contract.

## Ponytail

Khi code, ưu tiên cách tối giản đúng nghĩa:

1. Không cần thì đừng build.
2. Có sẵn trong codebase thì reuse.
3. Stdlib làm được thì dùng stdlib.
4. Native platform làm được thì dùng native.
5. Tránh thêm dependency mới nếu vài dòng là đủ.
6. Viết ít file nhất, diff nhỏ nhất, không abstraction thừa.

Luôn đọc flow liên quan trước khi sửa. Fix root cause, không vá triệu chứng.
Không được tối giản mất validation, error handling quan trọng, security, accessibility.

## Quy Tắc Bảo Mật

Hãy coi mọi input từ bên ngoài là không đáng tin, bao gồm:

- HTTP input
- webhook payload
- file upload
- response từ third-party API
- environment variables
- output từ LLM

Luôn luôn:

- validate input tại boundary
- dùng database access có parameterization
- không lộ lỗi nội bộ
- bảo vệ secrets
- kiểm tra authorization ở mọi thao tác được bảo vệ

Phải hỏi trước khi:

- thay đổi auth flow
- lưu loại dữ liệu nhạy cảm mới
- thay đổi CORS hoặc trust boundary
- thêm third-party integration mới
- thêm bề mặt upload file

Tuyệt đối không:

- commit secrets
- log token, password, hoặc dữ liệu nhạy cảm khác
- tin client-side validation như một security control
- đưa dữ liệu không đáng tin vào SQL, shell command, `eval`, hoặc render HTML thô

## Lệnh Chuẩn Của Repository

Hãy dùng các lệnh chuẩn sau, trừ khi task đòi hỏi khác:

- Dev: `npm run start:dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Unit tests: `npm test`
- Coverage: `npm run test:cov`
- E2E tests: `npm run test:e2e`
- Prisma generate: `npm run prisma:generate`
- Prisma migrate: `npm run prisma:migrate`

## Bối Cảnh Repository

- Stack: NestJS 11, Prisma 7, PostgreSQL, Zod, Redis, Passport JWT
- Cấu trúc backend chính mong đợi: controller -> service -> repository -> prisma
- Ưu tiên nhất quán với structure và naming hiện có trước khi đưa pattern mới vào

## Checklist Hoàn Thành

Trước khi tuyên bố task đã xong, xác nhận:

- đã dùng đúng workflow của skill phù hợp
- assumptions đã được nêu ra
- phạm vi đã được giữ chặt
- test hoặc bước verify phù hợp đã thực sự được chạy khi cần
- build/lint đã pass khi có liên quan
- mọi vùng rủi ro hoặc chưa verify đã được nêu rõ

Nếu task đơn giản và mang tính cơ học, giữ quy trình gọn nhẹ. Nếu task mơ hồ hoặc ảnh hưởng lớn, phải siết quy trình chặt hơn chứ không được lỏng đi.
