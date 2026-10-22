FROM postgres:17.8

ENV PATH="/opt/patroni/bin:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv gettext-base \
    && rm -rf /var/lib/apt/lists/* \
    && python3 -m venv /opt/patroni \
    && /opt/patroni/bin/pip install --no-cache-dir \
        "patroni[etcd3,psycopg3]==4.1.5" \
        "psycopg[binary]==3.3.6"

COPY patroni.yml /etc/patroni/patroni.yml.tmpl
COPY entrypoint.sh /usr/local/bin/patroni-entrypoint.sh
COPY post-bootstrap.sh /usr/local/bin/post-bootstrap.sh

RUN chmod 755 /usr/local/bin/patroni-entrypoint.sh /usr/local/bin/post-bootstrap.sh

ENTRYPOINT ["/usr/local/bin/patroni-entrypoint.sh"]
