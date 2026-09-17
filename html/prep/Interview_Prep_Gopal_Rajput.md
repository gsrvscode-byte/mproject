# Interview Preparation — Gopal Rajput
### Node.js Full Stack Developer | PolicyBoss Experience

Prepare **two things separately**:
1. **Self Introduction** — 60–90 seconds
2. **Project / Module Explanation** — 3–5 minutes

---

## 1. Self Introduction (60–90 seconds)

> Good morning / afternoon.
>
> My name is Gopal Rajput, and I am a Node.js Full Stack Developer with 3.5+ years of professional experience.
>
> Currently, I am working with Landmark Insurance Brokers, also known as PolicyBoss, as a Node.js Full Stack Developer. My primary responsibility is developing and maintaining insurance-based applications and backend services.
>
> I mainly work with Node.js, Express.js, JavaScript, TypeScript, React.js, Angular, MongoDB, MySQL, PostgreSQL, Redis, RabbitMQ, Docker, AWS and REST APIs.
>
> In my current project, I have worked on multiple insurance modules such as Proposal, KYC, Payment, EMI, Policy Issuance, Travel, Health, Motor and Admin/POSP modules.
>
> I have also worked on multiple third-party insurer integrations using REST, XML and SOAP APIs. My responsibilities include creating backend APIs, implementing business validations, transforming requests according to insurer requirements, processing responses, handling errors and retries, and maintaining transaction and policy status.
>
> For payment processing, I have worked with Razorpay for order creation, payment verification, callbacks and failure/retry scenarios.
>
> Recently, I also worked on an AI-based PDF parsing module where insurance documents are processed and required information is extracted into structured JSON using OpenAI APIs.
>
> From a deployment and infrastructure perspective, I have experience with Docker, Nginx, PM2, Jenkins and AWS services such as EC2, S3 and Lambda.
>
> Overall, my main strength is backend development, API integration, business logic implementation and working with third-party systems while also having full-stack experience with React and Angular.

---

## 2. "Tell me about your current project"

**Don't immediately list all modules — first explain the business/project.**

> Currently, I am working on an insurance platform for PolicyBoss, where customers can purchase different types of insurance such as Health, Travel, Motor and Two-Wheeler insurance.
>
> The application covers the complete insurance journey, starting from customer details and quotation generation, followed by proposal creation, KYC verification, payment, and finally policy issuance.
>
> Our backend is mainly built using Node.js and Express.js. We integrate with multiple insurance companies because each insurer has different APIs, business rules and request/response formats.
>
> Depending on the insurer, we work with REST, XML or SOAP-based integrations.
>
> My responsibility is mainly on the backend side. I develop APIs, implement business validations, integrate third-party insurer APIs, transform requests and responses, handle errors and retries, maintain transaction and policy status, and support production issues.
>
> I have also worked on payment integration using Razorpay and an AI-based PDF parsing module using OpenAI APIs.

---

## 3. "Can you explain the architecture?"

```
                    Customer / POSP
                          |
                          v
                   Frontend Application
                    React / Angular
                          |
                          v
                   Node.js / Express
                          |
              +-----------+-----------+
              v           v           v
           MongoDB      MySQL       Redis
              |
              v
       Business Logic Layer
              |
       +------+-------+
       v      v       v
     KYC   Payment   Proposal
       |      |       |
       v      v       v
   Insurers Razorpay Insurers
       |
       v
 REST / XML / SOAP
       |
       v
 Insurance Companies
```

**How to explain it:**

> "At a high level, the customer or POSP interacts with the frontend application. The frontend communicates with our Node.js and Express.js backend through REST APIs. The backend handles authentication, validation and business logic and communicates with databases such as MongoDB or MySQL. For frequently accessed data, Redis can be used for caching. For external integrations, our backend communicates with different insurers using REST, XML or SOAP APIs. Payment processing is handled through Razorpay, and the final policy status is maintained based on the insurer response."

---

## 4. Complete Insurance Journey (very important)

```
Customer
   |
Select Insurance Product
   |
Quotation
   |
Proposal
   |
KYC
   |
Medical / Additional Details
   |
Payment
   |
Insurer API
   |
Policy Issuance
   |
Policy Document
```

**Speak like this:**

> The complete flow starts when the customer selects an insurance product and provides the required information.
>
> First, we generate the quotation based on factors such as customer age, members, plan, coverage, location, travel dates or vehicle details depending on the product.
>
> Once the customer selects a plan, we create the proposal. At this stage, we collect and validate customer details, member information, nominee details, medical declarations and other required information.
>
> After that, KYC verification is performed. Depending on the insurer, we call the respective KYC API and validate the response.
>
> Once the proposal and KYC requirements are completed, the customer proceeds to payment. For payment, I have worked with Razorpay where we create an order, verify the payment and handle callbacks, failures and retries.
>
> After successful payment, we send the required proposal information to the insurer. Since different insurers have different APIs, we may communicate using REST, XML or SOAP.
>
> The insurer processes the proposal and returns the policy issuance response. We process that response, update the policy and transaction status, and finally make the policy document or policy details available to the customer.

---

## 5. "Which modules did you work on?"

**Opening line:**

> "I have mainly worked on Proposal, KYC, Payment and EMI, Policy Issuance, Travel, Health, Motor, Admin/POSP and multiple third-party insurer integrations."

Then explain the important ones (below).

---

## 6. Proposal Module

| | |
|---|---|
| **What?** | The Proposal module is responsible for creating an insurance proposal after the customer selects a quotation. |
| **What I built?** | APIs for customer details, member details, nominee details, medical declarations, KYC-related information and proposal creation. |
| **How?** | Backend developed using Node.js and Express.js. We validate the incoming request and apply business rules before preparing the insurer-specific request. |
| **Challenge?** | Different insurers had different business rules — age eligibility, member relationships, mandatory fields and medical declarations varied between insurers. |

**Complete answer:**

> "In the Proposal module, after quotation selection, the customer enters the required information. My responsibility was to develop and maintain APIs that validate customer, member, nominee and medical information and then prepare the proposal request. Since different insurers have different business rules, I implemented insurer-specific validations and request transformations before sending the proposal to the insurer."

---

## 7. KYC Module

> "In the KYC module, I worked on insurer-specific KYC fetch and verification APIs. The customer identity information is sent to the respective insurer or KYC service, and we process the response to determine whether the KYC was successful, pending or failed.
>
> I used Node.js, Express.js and Axios for these integrations. One challenge was that different insurers returned different response structures and status values, so we had to validate and normalize those responses before continuing the proposal flow."

**Keywords to remember:** `Fetch → Verify → Validate → Status → Error Handling`

---

## 8. Payment Module

> "In the Payment module, I worked on Razorpay integration. The flow starts with creating a payment order based on the premium amount. After the customer completes the payment, we verify the payment response and update the transaction status.
>
> I also handled callbacks, payment failures and retry scenarios. One important consideration was avoiding incorrect status updates in cases such as duplicate callbacks or inconsistent payment responses."

**Flow:**

```
Customer
   |
Create Order
   |
Razorpay
   |
Customer Payment
   |
Callback / Response
   |
Payment Verification
   |
Update Transaction
   |
Continue Policy Flow
```

**Interview keywords:** `Order Creation → Payment → Verification → Callback → Retry → Status`

---

## 9. EMI Module

> "In the EMI module, I worked with different payment frequencies such as Monthly, Quarterly and Half-Yearly. The backend needs to maintain the EMI-related information and transaction status and integrate it with the overall policy journey.
>
> I also worked with ERP-related status handling, where payment and ERP responses need to be tracked correctly."

---

## 10. Policy Issuance

> "Policy issuance happens after the required proposal, KYC and payment steps are successfully completed. At this stage, we send the required proposal information to the insurer.
>
> I worked on integrating insurer APIs, processing their responses, handling success and failure cases and updating the policy status. Depending on the insurer, the integration could be REST, XML or SOAP."

**Flow:**

```
Proposal
   |
KYC Completed
   |
Payment Successful
   |
Insurer API
   |
Policy Generation
   |
Policy Number
   |
Policy Document
```

---

## 11. Insurer Integration — Your Strongest Technical Area

**Go deeper here if the interviewer is technical.**

> "One of the major areas I have worked on is third-party insurer integration. Different insurance companies expose different APIs and formats. Some use REST APIs with JSON, while others use XML or SOAP.
>
> On our backend, I first validate the incoming request and prepare a common application-level object. Then, based on the insurer, I transform that data into the required request format.
>
> For REST APIs, we send JSON requests. For XML or SOAP APIs, we generate the required XML structure and call the insurer service.
>
> After receiving the response, we parse it, map the insurer-specific status to our application status and handle success, failure, retry or validation scenarios.
>
> This approach allows us to keep our core business flow consistent while handling insurer-specific requirements separately."

**Architecture:**

```
                    Application
                         |
                         v
                  Common Request
                         |
                         v
              Insurer-Specific Logic
                  /      |       \
                 /       |        \
               REST     XML      SOAP
                |         |        |
                v         v        v
             Insurer   Insurer   Insurer
                \         |        /
                 \        |       /
                  v       v      v
                  Response Parsing
                         |
                         v
                  Common Response
```

**Interview line:**

> **"The key challenge was maintaining a common business flow while supporting different insurer-specific APIs, formats and business rules."**

---

## 12. ERP CS Travel

**Shows you've worked on real production APIs, not just CRUD.**

> "I also worked on an ERP Customer Service API for Travel. The API receives customer or policy-related information and sends it to the ERP system.
>
> We had separate flows for POSP and non-POSP requests. Based on the request, we prepared the appropriate XML and called the respective ERP service.
>
> I implemented request validation, mandatory-field checks, XML request preparation, ERP API integration, response processing and status handling.
>
> We also handled different responses such as SUCCESS, DUPLICATE, TRYAGAIN, VALIDATION and EXCEPTION. I added logging so that requests and responses could be tracked for debugging and production support."

**Flow:**

```
Client
  |
/erp_cs_travel
  |
Request Validation
  |
POSP / Non-POSP
  |
Prepare XML
  |
ERP API
  |
Response
  |
Status Mapping
  |
Logging
  |
Response to Client
```

---

## 13. AI PDF Parser

> "I also worked on an AI-based PDF parsing module. The objective was to extract useful information from insurance-related PDF documents and convert it into structured JSON.
>
> The document is uploaded to storage such as S3, and then the backend triggers the processing flow. The document is processed through the AI service and OpenAI API, and the required fields are extracted into a structured JSON format.
>
> The major challenge was that PDF documents can have different layouts and inconsistent information. Therefore, we needed proper validation of the extracted data before using it in the application."

**Flow:**

```
PDF
 |
S3
 |
Node.js Backend
 |
AI Processing
 |
OpenAI API
 |
Structured JSON
 |
Validation
 |
Application / Database
```

---

## 14. "What was your exact responsibility?" (very likely question)

> "My primary responsibility was backend development. I developed and maintained REST APIs using Node.js and Express.js, implemented business validations, integrated third-party insurer APIs, handled REST/XML/SOAP request and response processing, worked on payment integration, handled errors and retries, maintained transaction and policy statuses, and supported production issues. I also worked on frontend changes when required using React or Angular."

---

## 15. "What technologies did you use?" (group them — don't just list)

| Category | Technologies |
|---|---|
| **Backend** | Node.js, Express.js, JavaScript, TypeScript |
| **Frontend** | React.js, Angular |
| **Database** | MongoDB, MySQL, PostgreSQL |
| **Caching / Messaging** | Redis, RabbitMQ |
| **Cloud / DevOps** | AWS EC2, S3, Lambda, Docker, Nginx, PM2, Jenkins |
| **Integration** | REST, XML, SOAP, Razorpay |
| **AI** | OpenAI APIs |

**Interview answer:**

> "My primary stack is Node.js and Express.js for backend development, with React and Angular on the frontend. I have worked with MongoDB, MySQL and PostgreSQL, and Redis for caching. For asynchronous processing and messaging, I have exposure to RabbitMQ. On the DevOps side, I have worked with Docker, Nginx, PM2, Jenkins and AWS services such as EC2, S3 and Lambda."

---

## 16. Full 3–4 Minute Project Answer

**Use this when asked:** *"Explain your project and your role."*

> Currently, I am working on an insurance platform at PolicyBoss. The platform provides different insurance products such as Health, Travel, Motor and Two-Wheeler insurance.
>
> The overall customer journey starts with quotation generation. Based on the customer's information and selected plan, we calculate or receive the premium quotation. After the customer selects a plan, we create the proposal and collect customer details, member information, nominee details, medical declarations and other required information.
>
> After proposal creation, the KYC process is performed. I have worked on insurer-specific KYC fetch and verification APIs and handled different KYC responses and statuses.
>
> Once the proposal and KYC requirements are completed, the customer proceeds to payment. I have worked on Razorpay integration, including order creation, payment verification, callbacks, failure handling and retry scenarios.
>
> After successful payment, the policy issuance process is triggered. We send the required proposal information to the respective insurer. Since we integrate with multiple insurers, different insurers use different API formats such as REST, XML and SOAP. I have worked on preparing insurer-specific requests, calling the APIs, parsing responses and mapping insurer-specific statuses into our application.
>
> One of the major challenges is that every insurer has different business rules, mandatory fields, request formats and response structures. To handle this, we keep the common business flow consistent and implement insurer-specific validation and request/response transformation where required.
>
> I have also worked on an ERP Customer Service API for Travel, where I handled POSP and non-POSP flows, XML request generation, ERP integration, response status handling and logging.
>
> Recently, I also worked on an AI-based PDF parsing module. The objective was to extract required information from insurance documents and convert it into structured JSON using an AI processing flow and OpenAI APIs.
>
> My primary responsibility is backend development using Node.js and Express.js, including API development, business logic, third-party integrations, database interaction, error handling, retry handling and production support. I also have frontend experience with React and Angular and exposure to Docker, AWS, Jenkins, Nginx and PM2.

---

## 17. Education — "Tell me about your education"

**Normal (short) answer — use this first, every time:**

> "I completed my MCA — Master of Computer Applications — from Abhinav Education Society's Institute of Management and Research, and before that my B.Sc. in Computer Science from Late Pandharinath Patil Institute of Management Studies, Aurangabad. During my studies, I built a strong foundation in programming, data structures and web development, which helped me move directly into full-stack development roles."

**If they go deeper (e.g. "Why MCA after B.Sc.? What did you learn?"):**

> "I chose to do an MCA to strengthen my technical foundation and move specifically toward software development, since B.Sc. Computer Science gave me the fundamentals but I wanted deeper, more practical exposure to programming and application development. During MCA, I worked on projects involving web development and databases, which is where I got hands-on with technologies like JavaScript, Node.js and SQL — that's what led me into full-stack development professionally."

**Keep ready but don't volunteer unless asked:**
- Course duration / years, if asked directly
- Any academic project details, if you want to mention one specific project (only prepare this if you actually want to talk about it)

---

## 18. First Company — Virtual SCM Pvt. Ltd. (Jr. Software Developer, Transport ERP)

**Normal (short) answer — use this first:**

> "My first role was as a Jr. Software Developer at Virtual SCM in Pune, where I worked on a Transport ERP web application. I built backend APIs using Node.js and Express.js, and worked on the React.js frontend as well. The application handled transportation and logistics operations — things like vehicle, driver, customer and trip management, along with E-Way Bill generation."

**If they ask "What exactly did you build?" (go deeper):**

| | |
|---|---|
| **What?** | A Transport ERP system for managing transportation and logistics operations — vehicles, drivers, customers, transporters, trips and shipments. |
| **What I built?** | REST APIs for CRUD operations across ERP modules, E-Way Bill generation and tracking workflows, and reusable React.js components for the dashboards. |
| **How?** | Node.js and Express.js on the backend, PostgreSQL for the database, React.js with HTML5/CSS3/Bootstrap on the frontend. |
| **Challenge?** | E-Way Bill generation required integrating with an external API and handling different response statuses, plus keeping data consistent across trip, shipment and vehicle records that were all related to each other. |

**Complete deeper answer:**

> "In the Transport ERP application, my main job was building the backend APIs — using Node.js and Express.js — for modules like vehicle management, driver management, customer and transporter management, and trip/shipment tracking. I also worked on E-Way Bill generation, which involved integrating with an external API, validating the request, and handling the response and status tracking.
>
> On the database side, I worked with PostgreSQL — designing schemas, writing queries with joins, and optimizing them since the ERP had a lot of related data across modules. On the frontend, I built reusable React.js components for the operational dashboards, along with search, filtering and pagination for handling large volumes of records.
>
> This role gave me a strong foundation in full-stack development and REST API design, which I later built on in my current role at PolicyBoss."

**Keywords to remember:** `Transport ERP → Vehicle/Driver/Trip modules → E-Way Bill → PostgreSQL → React.js frontend`

**If asked "Why did you leave / what's the gap after this job?"**

> "I left to focus on upskilling and freelancing for a few months before joining PolicyBoss, where I could work on more complex, production-scale backend systems and grow into insurance-domain API integrations."

*(Adjust this line to match what you actually did in that gap — keep it short and forward-looking.)*

---

## ⭐ Most Important Interview Formula

For **every technical question**, answer in this order:

```
1. WHAT       -> What is the purpose?
2. MY PART    -> What did I personally implement?
3. HOW        -> Which technology / architecture did I use?
4. CHALLENGE  -> What problem did I solve?
5. RESULT     -> What happened after my implementation?
```

**Example — Payment:**

```
WHAT          Payment processing
MY PART       Razorpay order + verification + callback
HOW           Node.js + Express.js + Razorpay API
CHALLENGE     Failure + retry + duplicate callback
RESULT        Correct payment status and continuation of policy flow
```

### The key thing to remember

Don't memorize every sentence. Memorize the **keywords**:

**Proposal → KYC → Payment → EMI → Policy → Insurer Integration → ERP → AI PDF**

And for every module: **What → Built → How → Challenge**

This gives you enough structure to answer naturally even when the interviewer asks unexpected follow-up questions.
