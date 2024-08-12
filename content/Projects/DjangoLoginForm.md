---
title: 'Writing a custom login form for SPAs with Django'
date: 2024-05-29
thumbnail: /DjangoLoginForm/thumbnail.png
description: "In the world of modern computing, there are many great out of the box tools for handling authentication and authorization. However, to make sure I understood my fundamentals, I decided to custom make a login form for my portfolio project LnkShrt"
tags: ["SoftwareEngineer"]
---


In the world of modern computing, there are many great out of the box tools for handling authentication and authorization, [NextAuth](https://next-auth.js.org/) for example. However, to make sure I understood my fundamentals, I wanted to make a login form for my portfolio project [LnkShrt](lnkshrt.net)

## The Goal

As a way to keep up with the changes in modern web infrastructure, earlier this year I decided to put together a link shortening application using the NextJS, Django, and Postgres as my tech stack. It's been a fun project, and I've caught up on the tools that makes building modern web applications fun and expedient, like the awesome new app router in NextJS. But one thing I've never actually taken the time to do by hand is make a login page. 

Now, I know there are lots of tools out there for implementing OAUTH and other super secure well supported [AAA](https://en.wikipedia.org/wiki/AAA_(computer_security)) frameworks. The goal of this was for me to understand the fundamentals of what a login page should look and behave like as a developer.


This process was a bit harder than I expected, because while Django has excellent AAA tools, most of them assume that you will be using the mixin they've developed for Django's site generation tools. However, my site has a NextJS frontend, so this approach wouldn't work. So, I set out with a few goals in mind:

- Using Django, create an API for creating, updating, and deleting users
- Using NextJS, interact with this API to create users, log in and out, and detect permissions
- Prevent editing links that had been created by other users
- Maintain an "anonymous" mode for creating and managing links


## The Backend (Django, Python)

Fortunately for me, Django Rest Framework has lots of tools for handling AAA built into the software, though not all of them are enabled by default. So, the first step was updating my `settings.py` to enable the authentication modes I wanted to support.

### settings.py
```Python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ]
}
```

Next up was creating the serializers that I would use to validate user requests. Here, I would make sure the requests were formatted correctly, and didn't conflict with any existing data in the case of new user requests. 

To do this, I created a new file to store my login serializers, and made three new serializer classes to validate data sent to the `login`, `signup`, and `manageUser` endpoints.

### serializers.py
```Python
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers


# The important part here is that username is a valid email, and that the password
# passes Django's password checks. If all conditions are met, we return a valid request
# and the user who is to be logged in
class LoginSerializer(serializers.Serializer):
    username = serializers.EmailField(label="Username", write_only=True)
    password = serializers.CharField(
        label="Password",
        style={"input_type": "password"},
        trim_whitespace=False,
        write_only=True,
    )

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            user = authenticate(
                request=self.context.get("request"), username=username, password=password
            )

            if not user:
                msg = "Incorrect username or password"
                raise serializers.ValidationError(msg, code="authorization")

        else:
            msg = "username and password both required"
            raise serializers.ValidationError(msg, code="authorization")

        attrs["user"] = user
        return attrs


# Here, we make sure that there is a valid email and password, and that the email has
# not already been registered
class NewUserSerializer(serializers.Serializer):
    username = serializers.EmailField(label="Username", write_only=True)
    password = serializers.CharField(
        label="Password",
        style={"input_type": "password"},
        trim_whitespace=False,
        write_only=True,
    )

    def validate(self, attrs):
        username = attrs.get("username")
        password = attrs.get("password")

        if username and password:
            try:
                user = User.objects.get(username=username)
                msg = "user already exists"
                raise serializers.ValidationError(msg, code="authorization")
            except User.DoesNotExist:
                pass

            user = User.objects.create_user(username, username, password)
            user.save()

            attrs["user"] = user
            return attrs

        else:
            msg = "username and password both required"
            raise serializers.ValidationError(msg, code="authorization")


# for updating the password, we simply make sure the provided password is valid
class UpdatePasswordSerializer(serializers.Serializer):
    password = serializers.CharField(
        label="Password",
        style={"input_type": "password"},
        trim_whitespace=False,
        write_only=True,
    )
```

With these serializers put together, I could actually start implementing some views to interact with the models, relatively sure that I wouldn't break anything by passing bad data to my database. 

### views.py

```Python
# First, I needed to import the serializers I just created.
from . import serializers


# For a new user, I check the validator, and if the request was not valid,
# Then return the default error if not, otherwise we return 201(created)
class NewUserView(APIView):
    # Since you want to be able to create a new account if you don't already have 
   	# an account, we allow any user to access this view.
    permission_classes = (permissions.AllowAny,)

    def post(self, request, format=None):
        serializer = serializers.NewUserSerializer(
            data=self.request.data, context={"request": self.request}
        )
        serializer.is_valid(raise_exception=True)

        return JsonResponse({"response": "User was created"}, status=201)


# Login is much the same as new user, but upon a valid request we run the `login`
# function, which creates new session and csrf tokens for the end user that are 
# included in the response
class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, format=None):
        serializer = serializers.LoginSerializer(
            data=self.request.data, context={"request": self.request}
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)

        return JsonResponse({"response": "user was logged in"}, status=202)


class LogoutView(APIView):
		# Since we only want logged in users to be able to log out, this view requires
	  # authentication. This also allows us to guarantee the session key exists, since 	
	  # we are using session authentication
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, format=None):
        Session.objects.filter(session_key=request.session.session_key).delete()
        return JsonResponse({"response": "Successfully logged out"}, status=200)


# The manage user view allows for TWO actions! You can change your password with a 
# post request that includes a valid password, or delete your account all together.
class ManageUserView(APIView):
		# As with the logout view, we require authentication here. We use the logged in user
	  # as the target for any actions, to prevent any user editing another users data
    permission_classes = (permissions.IsAuthenticated,)
    http_method_names = ["post", "delete"]

    # Update password
    def post(self, request, format=None):
        serializer = serializers.UpdatePasswordSerializer(
            data=self.request.data, context={"request", self.request}
        )
        serializer.is_valid(raise_exception=True)

				# using the `set_password` method automatically invalidates all existing sessions.
        request.user.set_password(serializer.validated_data["password"])
        request.user.save()

        return redirect("/login")

    # Remove User
    def delete(self, request, format=None):
        request.user.delete()
        return JsonResponse({"response": "User deleted."}, status=204)
```

And finally, with my views created I could add them to my urls file to make sure that Django could route requests to them!

### urls.py
```Python
from . import views

urlpatterns = [
		...
    path("api/login/", views.LoginView.as_view()),
    path("api/logout/", views.LogoutView.as_view()),
    path("api/signup/", views.NewUserView.as_view()),
    path("api/manageUser/", views.ManageUserView.as_view()),
		...
] 
```

Alright! Now that we have a functioning system in our backend to handle users, we just need to create the UI and logic on the frontend to log users in and manage their state.

## The Frontend

Now, I have a functional backend and the next thing I need is a way to talk to the backend from my website. I'll spare you the html/css I used to style the site, and try to focus on the actual logic. To that end, the first thing I put together was a way to check the login state and route the website accordingly. Since the session cookie that the backend generates is `http-only`, I can't interact with it from JavaScript. Ultimately, this is what I want since I don't want anyone to be able to scape users sessions using JavaScript. However, this raises the question of how I know if the user is logged in or not. The solution I went with was creating a `loggedin` cookie when the user successfully logs in, and deleting it after a successful logout. While you could spoof this cookie, you wouldn't actually be able to access any information without a valid session cookie to pass to the server.

For actually managing this logic, I used the awesome Axios, and JSCookie libraries, to make the request and manage the state

```JavaScript
  const login = async (event) => {
    let body = {
      username: values.username,
      password: values.password,
    };

    let csrf = Cookies.get("csrftoken");
    let headers = {
      headers: {
        "X-CSRFToken": csrf,
      },
    };

    Axios.post("/api/login/", body, headers)
      .then((response) => {
        Cookies.set("loggedin", true);
        router.push("/manageAccount");
      })
      .catch((error) => {
        console.log(error);
        setError(error.response.data.non_field_errors[0]);
      });
  };

  const signup = async (event) => {
    let csrf = Cookies.get("csrftoken");
    var headers = {
      headers: {
        "X-CSRFToken": csrf,
      },
    };

    let body = {
      username: values.username,
      password: values.password1,
    };

    Axios.post("api/signup/", body, headers)
      .then((response) => {
        router.push("/login");
        setError("");
      })
      .catch((error) => {
        console.log(error);
      });
  };


  const changePassword = async (event) => {
    let body = {
      password: values.password1,
    };

    let csrf = Cookies.get("csrftoken");
    let headers = {
      headers: {
        "X-CSRFToken": csrf,
      },
    };

    Axios.post("/api/manageUser/", body, headers)
      .then((response) => {
        setError("");
        Cookies.remove("loggedin");
        router.push("/login");
      })
      .catch((error) => {
        setError("Something went wrong, try again later.");
        console.log(error);
      });
  };

  const deleteAccount = async (event) => {
    let csrf = Cookies.get("csrftoken");
    let headers = {
      headers: {
        "X-CSRFToken": csrf,
      },
    };

    Axios.delete("/api/manageUser/", headers)
      .then((response) => {
        Cookies.remove("loggedin");
        router.push("/login");
      })
      .catch((error) => {
        setError("Something went wrong, try again later.");
        console.log(error);
      });
  };

  const logOut = async (event) => {
    let csrf = Cookies.get("csrftoken");
    let headers = {
      headers: {
        "X-CSRFToken": csrf,
      },
    };

    Axios.post("/api/logout/", {}, headers)
      .then((response) => {
        Cookies.remove("loggedin");
        router.push("/login");
      })
      .catch((error) => {
        setError("Something went wrong, try again later.");
        console.log(error);
      });
  };

```

From there, I route the application based on the `loggedin` cookie, and responses from 
the backend.

Additionally, to validate my form input on the frontend (even though we double check 
this on the backend for security reasons) I implemented the Formik library, which makes 
form creation and validation a breeze. You can see the components below. 

```JavaScript
<!-- Password change form -->
<Formik
	initialValues={{ password1: "", password2: "" }}
	validate={(values) => {
		const errors = {};
		if (!values.password1) {
			errors.password1 = "Requried";
		} else if (values.password1 != values.password2) {
			errors.password1 = "Passwords do not match";
			errors.password2 = "Passwords do not match";
		}
		return errors;
	}}
	onSubmit={(values, { setSubmitting }) => {
		changePassword(values);
	}}
>
	{({ isSubmitting }) => (
		<Form className="flex flex-col space-around w-full border-2 border-solid border-white rounded-md p-4">
			<label className="text-white text-lg pb-2">Change Password</label>
			<Field
				type="password"
				id="password1"
				className="flex-grow rounded-full px-5 p-2 m-1 text-black"
				placeholder="new password"
			/>
			<ErrorMessage name="password1" component="div" />
			<Field
				required
				type="password"
				id="password2"
				className="flex-grow rounded-full px-5 p-2 m-1 text-black"
				placeholder="confirm new password"
			/>
			<ErrorMessage name="password2" component="div" />
			<button
				type="submit"
				className="ms-10 font-black text-white bg-orange-500 disabled:bg-gray-200 p-2 self-end hover:bg-amber-500 active:bg-amber-400 text-lg rounded-full w-48"
			>
				Change Password
			</button>
		</Form>
	)}
</Formik>
```

```JavaScript
<!-- Login form -->
<Formik
      initialValues={{ email: "", password: "" }}
      validate={(values) => {
        const errors = {};
        if (!values.email) {
          errors.email = "Required";
        } else if (
          !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
        ) {
          errors.email = "Invalid email address";
        }
        return errors;
      }}
      onSubmit={(values, { setSubmitting }) => {
        login(values);
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col space-around w-full">
          <Field
            type="email"
            name="email"
            placeholder="you@example.com"
            className="flex-grow rounded-full px-5 p-2 m-1 text-black"
          />
          <ErrorMessage name="email" component="div" />
          <Field
            type="password"
            name="password"
            className="flex-grow rounded-full px-5 p-2 m-1 text-black"
            placeholder="password"
          />
          <ErrorMessage name="password" component="div" />
          <button
            type="submit"
            className="ms-10 font-black text-white bg-orange-500 disabled:bg-gray-200 p-2 self-end hover:bg-amber-500 active:bg-amber-400 text-lg rounded-full w-48"
            disabled={isSubmitting}
          >
            Login
          </button>
        </Form>
      )}
    </Formik>
```


```JavaScript
<!-- Signup form -->
<Formik
      initialValues={{ email: "", password1: "", password2: "" }}
      validate={(values) => {
        const errors = {};
        if (!values.email) {
          errors.email = "Required";
        } else if (
          !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)
        ) {
          errors.email = "Invalid email address";
        } else if (values.password1 != values.password2) {
          errors.password1 = "Passwords do not match";
          errors.password2 = "Passwords do not match";
        }
        return errors;
      }}
      onSubmit={(values, { setSubmitting }) => {
        submit(values);
      }}
    >
      {({ isSubmitting }) => (
        <Form className="flex flex-col space-around w-full">
          <Field
            type="email"
            name="email"
            placeholder="you@example.com"
            className="flex-grow rounded-full px-5 p-2 m-1 text-black"
          />
          <ErrorMessage name="email" component="div" />
          <Field
            type="password"
            name="password1"
            placeholder="password"
            className="flex-grow rounded-full px-5 p-2 m-1 text-black"
          />
          <ErrorMessage name="password1" component="div" />
          <Field
            type="password"
            name="password2"
            placeholder="password"
            className="flex-grow rounded-full px-5 p-2 m-1 text-black"
          />
          <ErrorMessage name="password2" component="div" />
          <button
            type="submit"
            disabled={isSubmitting}
            className="ms-10 font-black text-white bg-orange-500 disabled:bg-gray-200 p-2 self-end hover:bg-amber-500 active:bg-amber-400 text-lg rounded-full w-48"
          >
            Sign-up
          </button>
        </Form>
      )}
    </Formik>
```


## The logic

If the only thing my application did was let you log in and out of an account, with no connection to the data stored therein, it wouldn't be very interesting. Or useful. So, the last thing I need to do is create some interaction with the actual links that are being shortened. My idea was to allow logged in users to create links that only they could edit, but still allow community management of anonymously submitted links. That way you wouldn't *need* an account to interact with LnkShrt, but you could make one to improve your experience. These were the things I needed to do to implement this robustly:

- All links needed to be associated with a user
- I needed an anonymous user for links created by users without an account, and for links where the user had deleted their account
- All links needed to be *readable* by anyone, but only *writable* by their creator

The first two tasks were easy enough with a modification to the model in Django:

### models.py
```Python
# This creates or finds an existing sentinel user that can be used for anonymous or 
# deleted accounts
def get_sentinel_user():
    return get_user_model().objects.get_or_create(username="anon")[0].id


class Link(models.Model):
    link = models.URLField(blank=False)
	  # here we track the owner, either a user or a sentinel user
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        # When the owner is deleted, set owner to the sentinel user
        on_delete=models.SET(get_sentinel_user), 
        default=get_sentinel_user,
    )

    def __str__(self):
        return f"{self.id} -> {self.link}"
```

Finally, for the permissions, I had to update the view to detect whether or not the user was logged in, and change the logic slightly based on that state.

### views.py
```Python
# View for interacting with individual links
class LinkView(APIView):
    http_method_names = ["get", "post", "delete"]
		# anyone should be able to access this view, the behavior just changes
	  #  based on that state
    permission_classes = (permissions.AllowAny,)
    parser_classes = [JSONParser]

    # Create a new shortlink
    def post(self, request, id=-1):

        # Return existing link if one exists
        existing_links = Link.objects.filter(link=request.data["link"])
        if len(existing_links) > 0:
            serializer = LinkSerializer(existing_links[0])
            return JsonResponse(serializer.data)

        # Create new link if there is no existing link
        # If the request is anonymous, use the anon user, otherwise use request user
        if request.user.is_authenticated:
            request.data["owner"] = request.user.id
        else:
            request.data["owner"] = get_sentinel_user()

        serializer = LinkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return JsonResponse(serializer.data, status=201)

        # Return an error if a new valid link cannot be created
        return JsonResponse(serializer.errors, status=400)

    # Travel to an existing shortlink
    def get(self, request, id=-1):
        # Try to find the existing shortlink in the database
        try:
            link = Link.objects.get(id=id)
        # If it doesn't exist, return to the home page
        except Link.DoesNotExist:
            return redirect("/")

        serializer = LinkSerializer(link)
        return redirect(serializer.data["link"])

    # Delete link
    def delete(self, request, id=-1):
        # Check for link existence
        try:
            link = Link.objects.get(id=id)
        except Link.DoesNotExist:
            return JsonResponse({}, status=404)

        # Check if link is owned by the user, or is owned by the public (anon)
        if link.owner.id in [request.user.id, get_sentinel_user()]:
            link.delete()
            serializer = LinkSerializer(link)
            return JsonResponse(serializer.data, status=204)

        else:
            return JsonResponse({}, status=403)


# View for interacting with lists of links
class LinkListView(APIView, PageNumberPagination):
    serializer_class = LinkSerializer
    page_size = 5
    page_size_query_param = "page_size"
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        user_arr = [get_sentinel_user()]
        if request.user.is_authenticated:
            user_arr.append(request.user.id)

			  # Get any link owned by the logged in user, or the sentinel user
        entity = Link.objects.filter(owner__in=user_arr)

        results = self.paginate_queryset(entity, request, view=self)
        serializer = LinkSerializer(results, many=True)
        return self.get_paginated_response(serializer.data)

    def post(self, request):
        self.get(request)
```

And that's it! I've now got a functioning and useful AAA system implemented in LnkShrt! If you are interested in reading the full codebase for this project, you can find it on my (GitHub page)[https://github.com/TresSims/LnkShrt]. I really learned a lot going through this project, and hope to keep implementing more to this project to help me expand my experience with software development tooling and workflows. 
